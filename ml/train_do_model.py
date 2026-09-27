"""
第一阶段：按养殖场训练下一监测时刻的溶解氧回归模型。

数据流程：读取 CSV -> 自动识别字段 -> 合并时间 -> 构造滞后特征
-> 按养殖场时间顺序切分 -> Baseline/KNN/RandomForest -> 评估和保存结果。

本脚本只读取原始 CSV，不会修改原始文件，也不会修改 Vue 前端。
"""

from __future__ import annotations

import argparse
import json
import os
import re
from pathlib import Path

# Windows 某些环境无法读取物理 CPU 数量，固定为 1 可避免 joblib 探测警告。
os.environ.setdefault("LOKY_MAX_CPU_COUNT", "1")

import joblib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.neighbors import KNeighborsRegressor
from sklearn.preprocessing import StandardScaler


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CSV_PATH = PROJECT_ROOT.parent / "天津水产养殖检测数据_盐度平滑调整.csv"
ML_ROOT = PROJECT_ROOT / "ml"
MODEL_DIR = ML_ROOT / "models"
OUTPUT_DIR = ML_ROOT / "outputs"

# 只允许从这些业务指标中自动匹配实际列名。
METRIC_PATTERNS = {
    "temperature": ["水温", "temperature"],
    "ph": ["pH", "ph"],
    "dissolvedOxygen": ["溶解氧", "dissolvedoxygen", "dissolved oxygen", "do"],
    "ammoniaNitrogen": ["氨氮", "ammonianitrogen", "ammonia"],
    "salinity": ["盐度", "salinity"],
    "nitrite": ["亚硝酸盐", "亚硝酸", "nitrite"],
}
METRIC_LABELS = {
    "temperature": "水温",
    "ph": "pH",
    "dissolvedOxygen": "溶解氧",
    "ammoniaNitrogen": "氨氮",
    "salinity": "盐度",
    "nitrite": "亚硝酸盐",
}
METRIC_KEYS = list(METRIC_PATTERNS)
LAG_STEPS = [1, 2, 3, 5]


def normalize_text(value: object) -> str:
    """统一列名匹配用文本，不改变原始列名。"""
    return re.sub(r"[\s_()（）\[\]【】℃‰/]+", "", str(value).strip().lower())


def find_column(columns: list[str], patterns: list[str], field_label: str) -> str:
    """根据中文/英文关键词自动找到字段；找不到就明确报错。"""
    normalized_columns = {column: normalize_text(column) for column in columns}
    normalized_patterns = [normalize_text(pattern) for pattern in patterns]
    matches = [
        column
        for column, normalized in normalized_columns.items()
        if any(pattern and pattern in normalized for pattern in normalized_patterns)
    ]
    if not matches:
        raise ValueError(f"无法自动识别{field_label}字段。实际字段为：{columns}")
    return matches[0]


def detect_columns(dataframe: pd.DataFrame) -> dict[str, str]:
    """自动识别养殖场、日期、时间和六项指标的真实列名。"""
    columns = [str(column).replace("\ufeff", "").strip() for column in dataframe.columns]
    dataframe.columns = columns
    mapping = {
        "farm": find_column(columns, ["养殖场名称", "养殖场", "farm", "farmname"], "养殖场"),
        "date": find_column(columns, ["监测日期", "日期", "date"], "监测日期"),
        "time": find_column(columns, ["监测时间", "时间", "time"], "监测时间"),
    }
    for metric_key, patterns in METRIC_PATTERNS.items():
        mapping[metric_key] = find_column(columns, patterns, METRIC_LABELS[metric_key])
    return mapping


def parse_datetime(date_series: pd.Series, time_series: pd.Series) -> pd.Series:
    """把 2022_01_02 和 00h04m 这样的日期/时间合成 datetime。"""
    date_text = date_series.astype(str).str.strip().str.replace("_", "-", regex=False)
    time_text = time_series.astype(str).str.strip()
    extracted = time_text.str.extract(r"(?P<hour>\d{1,2})h(?P<minute>\d{1,2})m")
    normalized_time = extracted["hour"].str.zfill(2) + ":" + extracted["minute"].str.zfill(2)
    parsed = pd.to_datetime(date_text + " " + normalized_time, errors="coerce")
    fallback = pd.to_datetime(date_text + " " + time_text, errors="coerce")
    return parsed.fillna(fallback)


def slugify(value: str, index: int) -> str:
    """生成可用于模型文件名的养殖场名称。"""
    safe = re.sub(r"[^0-9A-Za-z\u4e00-\u9fff]+", "_", str(value)).strip("_")
    return f"{index:02d}_{safe or 'farm'}"


def rmse(y_true: pd.Series, y_pred: np.ndarray) -> float:
    """兼容不同 scikit-learn 版本的 RMSE 计算。"""
    return float(np.sqrt(mean_squared_error(y_true, y_pred)))


def build_features(raw_data: pd.DataFrame, mapping: dict[str, str]) -> tuple[pd.DataFrame, dict[str, int]]:
    """清洗字段、只做过去值填充，并构造时间、滞后和下一时刻目标。"""
    data = raw_data.copy()
    data["datetime"] = parse_datetime(data[mapping["date"]], data[mapping["time"]])
    data["farm_name"] = data[mapping["farm"]].astype(str).str.strip()

    missing_report: dict[str, int] = {"datetime": int(data["datetime"].isna().sum())}
    for metric_key in METRIC_KEYS:
        data[metric_key] = pd.to_numeric(data[mapping[metric_key]], errors="coerce")
        missing_report[metric_key] = int(data[metric_key].isna().sum())

    # 时间或养殖场无法识别的行无法安全参与时间序列训练，只在内存中丢弃。
    data = data.dropna(subset=["farm_name", "datetime"]).copy()
    data = data.sort_values(["farm_name", "datetime"]).reset_index(drop=True)

    # 只沿每个养殖场的时间方向前向填充，绝不使用未来数据，也不修改原始 CSV。
    data[METRIC_KEYS] = data.groupby("farm_name", group_keys=False)[METRIC_KEYS].ffill()
    missing_report["after_past_only_fill"] = int(data[METRIC_KEYS].isna().sum().sum())

    # 时间特征：hour、month、season 均来自当前时刻，不包含未来信息。
    data["hour"] = data["datetime"].dt.hour
    data["month"] = data["datetime"].dt.month
    data["season"] = ((data["month"] - 1) // 3 + 1).astype(int)

    # 对六项指标分别构造过去时刻的 lag1/lag2/lag3/lag5。
    for metric_key in METRIC_KEYS:
        feature_name = "DO" if metric_key == "dissolvedOxygen" else metric_key
        for lag in LAG_STEPS:
            data[f"{feature_name}_lag{lag}"] = data.groupby("farm_name")[metric_key].shift(lag)

    # 下一监测时刻是预测目标；target_time 用于输出准确的预测时间。
    data["target_do"] = data.groupby("farm_name")["dissolvedOxygen"].shift(-1)
    data["target_time"] = data.groupby("farm_name")["datetime"].shift(-1)

    feature_columns = METRIC_KEYS + ["hour", "month", "season"]
    for metric_key in METRIC_KEYS:
        feature_name = "DO" if metric_key == "dissolvedOxygen" else metric_key
        feature_columns.extend([f"{feature_name}_lag{lag}" for lag in LAG_STEPS])

    before_drop = len(data)
    data = data.dropna(subset=feature_columns + ["target_do", "target_time"]).copy()
    dropped_rows = before_drop - len(data)
    missing_report["dropped_after_lag_target"] = int(dropped_rows)
    data.attrs["feature_columns"] = feature_columns
    return data, missing_report


def evaluate_models_for_farm(farm_name: str, farm_data: pd.DataFrame, farm_index: int, feature_columns: list[str]) -> tuple[dict, list[dict]]:
    """对单个养殖场按时间切分，训练三个模型并输出指标和预测。"""
    farm_data = farm_data.sort_values("datetime").reset_index(drop=True)
    total_count = len(farm_data)
    train_count = int(total_count * 0.8)
    test_count = total_count - train_count
    if train_count < 2 or test_count < 1:
        raise ValueError(f"养殖场 {farm_name} 可用数据不足，无法进行 80%/20% 时间切分。")

    train = farm_data.iloc[:train_count].copy()
    test = farm_data.iloc[train_count:].copy()
    X_train = train[feature_columns]
    X_test = test[feature_columns]
    y_train = train["target_do"]
    y_test = test["target_do"]

    print(f"\n养殖场：{farm_name}")
    print(f"总数据量：{total_count}")
    print(f"训练集数量：{train_count}")
    print(f"测试集数量：{test_count}")
    print(f"训练集时间范围：{train['datetime'].min()} 至 {train['datetime'].max()}")
    print(f"测试集时间范围：{test['datetime'].min()} 至 {test['datetime'].max()}")
    print(f"时间切分检查：测试集开始时间晚于训练集结束时间 = {test['datetime'].min() > train['datetime'].max()}")

    # 1. Persistence Baseline：用当前时刻 DO 预测下一时刻 DO。
    baseline_pred = test["dissolvedOxygen"].to_numpy()

    # 2. KNN：只用训练集拟合 StandardScaler，避免测试集信息泄漏。
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    knn_neighbors = min(5, len(X_train_scaled))
    knn = KNeighborsRegressor(n_neighbors=knn_neighbors)
    knn.fit(X_train_scaled, y_train)
    knn_pred = knn.predict(X_test_scaled)

    # 3. RandomForest：严格只用训练集拟合。
    random_forest = RandomForestRegressor(n_estimators=200, random_state=42, n_jobs=1)
    random_forest.fit(X_train, y_train)
    random_forest_pred = random_forest.predict(X_test)

    model_predictions = {
        "baseline": baseline_pred,
        "knn": knn_pred,
        "random_forest": random_forest_pred,
    }
    farm_metrics = {}
    for model_name, predictions in model_predictions.items():
        farm_metrics[model_name] = {
            "mae": float(mean_absolute_error(y_test, predictions)),
            "rmse": rmse(y_test, predictions),
            "r2": float(r2_score(y_test, predictions)),
        }

    model_slug = slugify(farm_name, farm_index)
    joblib.dump({"model": knn, "scaler": scaler, "feature_columns": feature_columns, "farm_name": farm_name}, MODEL_DIR / f"knn_{model_slug}.joblib")
    joblib.dump({"model": random_forest, "feature_columns": feature_columns, "farm_name": farm_name}, MODEL_DIR / f"random_forest_{model_slug}.joblib")
    with (MODEL_DIR / f"feature_columns_{model_slug}.json").open("w", encoding="utf-8") as file:
        json.dump({"farm_name": farm_name, "feature_columns": feature_columns, "target": "target_do", "lag_steps": LAG_STEPS}, file, ensure_ascii=False, indent=2)

    prediction_rows = []
    for row_index, (_, row) in enumerate(test.iterrows()):
        prediction_rows.append({
            "养殖场": farm_name,
            "监测时间": row["target_time"].strftime("%Y-%m-%d %H:%M:%S"),
            "真实溶解氧": float(y_test.iloc[row_index]),
            "Baseline预测值": float(baseline_pred[row_index]),
            "KNN预测值": float(knn_pred[row_index]),
            "RandomForest预测值": float(random_forest_pred[row_index]),
        })

    # 每个养殖场单独绘图，便于比较真实值与两个机器学习模型。
    plt.figure(figsize=(13, 5))
    plt.plot(test["target_time"], y_test.to_numpy(), label="True DO", linewidth=1.8, color="#1f77b4")
    plt.plot(test["target_time"], knn_pred, label="KNN", linewidth=1.2, color="#ff7f0e")
    plt.plot(test["target_time"], random_forest_pred, label="Random Forest", linewidth=1.2, color="#2ca02c")
    plt.title(f"Dissolved Oxygen Prediction - Farm {farm_index}")
    plt.xlabel("Time")
    plt.ylabel("Dissolved Oxygen (mg/L)")
    plt.legend()
    plt.grid(alpha=0.25)
    plt.gcf().autofmt_xdate()
    plt.tight_layout()
    plt.savefig(OUTPUT_DIR / f"do_prediction_{model_slug}.png", dpi=160)
    plt.close()

    return farm_metrics, prediction_rows


def main() -> None:
    parser = argparse.ArgumentParser(description="训练下一监测时刻溶解氧预测模型")
    parser.add_argument("--csv", type=Path, default=DEFAULT_CSV_PATH, help="CSV 文件路径，默认读取项目外层指定文件")
    args = parser.parse_args()

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    csv_path = args.csv.resolve()
    if not csv_path.exists():
        raise FileNotFoundError(f"找不到 CSV 文件：{csv_path}")

    print(f"读取 CSV：{csv_path}")
    raw_data = pd.read_csv(csv_path, encoding="utf-8-sig")
    print(f"实际字段名：{list(raw_data.columns)}")
    mapping = detect_columns(raw_data)
    print("自动识别字段映射：")
    for key, column in mapping.items():
        print(f"  {key}: {column}")

    feature_data, missing_report = build_features(raw_data, mapping)
    print("\n缺失值检查（原始数值字段）：")
    for key, count in missing_report.items():
        print(f"  {key}: {count}")
    print(f"构造滞后特征后可用数据量：{len(feature_data)}")

    feature_columns = feature_data.attrs["feature_columns"]
    with (MODEL_DIR / "feature_columns.json").open("w", encoding="utf-8") as file:
        json.dump({"feature_columns": feature_columns, "target": "target_do", "raw_field_mapping": mapping, "lag_steps": LAG_STEPS}, file, ensure_ascii=False, indent=2)

    all_metrics = {}
    all_predictions = []
    farm_names = sorted(feature_data["farm_name"].dropna().unique().tolist())
    if len(farm_names) != 2:
        print(f"提示：自动识别到 {len(farm_names)} 个养殖场：{farm_names}")

    for farm_index, farm_name in enumerate(farm_names, start=1):
        farm_metrics, farm_predictions = evaluate_models_for_farm(farm_name, feature_data[feature_data["farm_name"] == farm_name], farm_index, feature_columns)
        all_metrics[farm_name] = farm_metrics
        all_predictions.extend(farm_predictions)

    predictions = pd.DataFrame(all_predictions).sort_values(["养殖场", "监测时间"])
    predictions.to_csv(OUTPUT_DIR / "predictions.csv", index=False, encoding="utf-8-sig")
    with (OUTPUT_DIR / "metrics.json").open("w", encoding="utf-8") as file:
        json.dump(all_metrics, file, ensure_ascii=False, indent=2)

    print("\n模型评价结果（每个养殖场测试集）：")
    print(f"{'养殖场':<24}{'模型':<18}{'MAE':>12}{'RMSE':>12}{'R²':>12}")
    print("-" * 78)
    for farm_name, metrics in all_metrics.items():
        for model_name, values in metrics.items():
            print(f"{farm_name:<24}{model_name:<18}{values['mae']:>12.4f}{values['rmse']:>12.4f}{values['r2']:>12.4f}")

    print("\n输出文件：")
    print(f"  预测结果：{OUTPUT_DIR / 'predictions.csv'}")
    print(f"  评价指标：{OUTPUT_DIR / 'metrics.json'}")
    print(f"  模型目录：{MODEL_DIR}")
    print(f"  特征列数量：{len(feature_columns)}")


if __name__ == "__main__":
    main()
