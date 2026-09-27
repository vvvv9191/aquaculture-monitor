"""
第二阶段：六项水质指标的下一监测时刻预测。

本脚本复用第一阶段的数据处理思路，但把目标扩展为：
水温、pH、溶解氧、氨氮、盐度、亚硝酸盐。

每个养殖场、每个指标分别训练：
1. Persistence Baseline
2. StandardScaler + KNNRegressor
3. RandomForestRegressor

脚本只读取原始 CSV，不修改原始文件，也不修改 Vue 前端。
"""

from __future__ import annotations

import argparse
import json
import os
import re
import warnings
from pathlib import Path

# Windows 某些环境无法读取物理 CPU 数量，固定为 1 避免 joblib 探测警告。
os.environ.setdefault("LOKY_MAX_CPU_COUNT", "1")
warnings.filterwarnings("ignore", message="Glyph .* missing from font")

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
PLOT_DIR = OUTPUT_DIR / "plots"

METRIC_KEYS = [
    "temperature",
    "ph",
    "dissolvedOxygen",
    "ammoniaNitrogen",
    "salinity",
    "nitrite",
]
METRIC_LABELS = {
    "temperature": "水温",
    "ph": "pH",
    "dissolvedOxygen": "溶解氧",
    "ammoniaNitrogen": "氨氮",
    "salinity": "盐度",
    "nitrite": "亚硝酸盐",
}
METRIC_OUTPUT_NAMES = {
    "temperature": "水温",
    "ph": "pH",
    "dissolvedOxygen": "溶解氧",
    "ammoniaNitrogen": "氨氮",
    "salinity": "盐度",
    "nitrite": "亚硝酸盐",
}
METRIC_PATTERNS = {
    "temperature": ["水温", "temperature"],
    "ph": ["pH", "ph"],
    "dissolvedOxygen": ["溶解氧", "dissolvedoxygen", "dissolved oxygen", "do"],
    "ammoniaNitrogen": ["氨氮", "ammonianitrogen", "ammonia"],
    "salinity": ["盐度", "salinity"],
    "nitrite": ["亚硝酸盐", "亚硝酸", "nitrite"],
}
LAG_STEPS = [1, 2, 3, 5]
TIME_FEATURES = ["hour", "month"]
MODEL_NAMES = ["baseline", "knn", "random_forest"]


def normalize_text(value: object) -> str:
    """统一列名匹配文本，不改变 CSV 原始列名。"""
    return re.sub(r"[\s_()（）\[\]【】℃‰/]+", "", str(value).strip().lower())


def find_column(columns: list[str], patterns: list[str], field_label: str) -> str:
    """根据中文或英文关键词自动识别字段。"""
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
    """自动识别养殖场、日期、时间和六项指标字段。"""
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
    """把 2022_01_02 和 00h04m 合并为 pandas datetime。"""
    date_text = date_series.astype(str).str.strip().str.replace("_", "-", regex=False)
    time_text = time_series.astype(str).str.strip()
    extracted = time_text.str.extract(r"(?P<hour>\d{1,2})h(?P<minute>\d{1,2})m")
    normalized_time = extracted["hour"].str.zfill(2) + ":" + extracted["minute"].str.zfill(2)
    parsed = pd.to_datetime(date_text + " " + normalized_time, errors="coerce")
    fallback = pd.to_datetime(date_text + " " + time_text, errors="coerce")
    return parsed.fillna(fallback)


def slugify(index: int) -> str:
    """用稳定的英文编号命名模型，避免中文文件名兼容问题。"""
    return f"farm{index:02d}"


def rmse(y_true: pd.Series, y_pred: np.ndarray) -> float:
    return float(np.sqrt(mean_squared_error(y_true, y_pred)))


def build_features(raw_data: pd.DataFrame, mapping: dict[str, str]) -> tuple[pd.DataFrame, dict[str, int], list[str]]:
    """按养殖场排序，构造时间特征、lag 特征和六个下一时刻目标。"""
    data = raw_data.copy()
    data["datetime"] = parse_datetime(data[mapping["date"]], data[mapping["time"]])
    data["farm_name"] = data[mapping["farm"]].astype(str).str.strip()

    missing_report: dict[str, int] = {"datetime": int(data["datetime"].isna().sum())}
    for metric_key in METRIC_KEYS:
        data[metric_key] = pd.to_numeric(data[mapping[metric_key]], errors="coerce")
        missing_report[metric_key] = int(data[metric_key].isna().sum())

    # 无法确定时间或养殖场的行无法参与时间序列，仍不修改原始文件。
    data = data.dropna(subset=["farm_name", "datetime"]).copy()
    data = data.sort_values(["farm_name", "datetime"]).reset_index(drop=True)

    # 只使用过去值前向填充。没有缺失时不会改变任何数值，也不会使用未来数据。
    data[METRIC_KEYS] = data.groupby("farm_name", group_keys=False)[METRIC_KEYS].ffill()
    missing_report["after_past_only_fill"] = int(data[METRIC_KEYS].isna().sum().sum())

    # 当前时刻的时间特征；预测目标是下一行，因此不存在目标时刻信息泄漏。
    data["hour"] = data["datetime"].dt.hour
    data["month"] = data["datetime"].dt.month

    feature_columns = METRIC_KEYS + TIME_FEATURES
    for metric_key in METRIC_KEYS:
        feature_name = "DO" if metric_key == "dissolvedOxygen" else metric_key
        for lag in LAG_STEPS:
            lag_name = f"{feature_name}_lag{lag}"
            data[lag_name] = data.groupby("farm_name")[metric_key].shift(lag)
            feature_columns.append(lag_name)

    for metric_key in METRIC_KEYS:
        data[f"target_{metric_key}"] = data.groupby("farm_name")[metric_key].shift(-1)
    data["target_time"] = data.groupby("farm_name")["datetime"].shift(-1)

    target_columns = [f"target_{metric_key}" for metric_key in METRIC_KEYS]
    before_drop = len(data)
    data = data.dropna(subset=feature_columns + target_columns + ["target_time"]).copy()
    missing_report["dropped_after_lag_target"] = int(before_drop - len(data))
    return data, missing_report, feature_columns


def calculate_metrics(y_true: pd.Series, predictions: np.ndarray) -> dict[str, float]:
    """计算单个模型的 MAE、RMSE、R²。"""
    values = {
        "mae": float(mean_absolute_error(y_true, predictions)),
        "rmse": rmse(y_true, predictions),
        "r2": float(r2_score(y_true, predictions)),
    }
    if not all(np.isfinite(list(values.values()))):
        raise ValueError("评价指标出现 NaN 或 inf，请检查数据和模型输入。")
    return values


def choose_best_model(model_metrics: dict[str, dict[str, float]]) -> str:
    """优先 MAE，再看 RMSE，最后用 R² 辅助选择。"""
    return min(model_metrics, key=lambda name: (model_metrics[name]["mae"], model_metrics[name]["rmse"], -model_metrics[name]["r2"]))


def train_one_target(
    farm_name: str,
    farm_data: pd.DataFrame,
    farm_index: int,
    metric_key: str,
    feature_columns: list[str],
    time_ranges: dict[str, str],
) -> tuple[dict[str, float], str, np.ndarray, dict[str, dict[str, str | None]]]:
    """对一个养殖场的一个目标指标训练三个模型。"""
    farm_data = farm_data.sort_values("datetime").reset_index(drop=True)
    total_count = len(farm_data)
    train_count = int(total_count * 0.8)
    test_count = total_count - train_count
    if train_count < 2 or test_count < 1:
        raise ValueError(f"养殖场 {farm_name} 可用数据不足，无法进行 80%/20% 切分。")

    train = farm_data.iloc[:train_count].copy()
    test = farm_data.iloc[train_count:].copy()
    X_train = train[feature_columns]
    X_test = test[feature_columns]
    y_train = train[f"target_{metric_key}"]
    y_test = test[f"target_{metric_key}"]

    # Persistence Baseline：当前时刻的该指标预测下一监测时刻。
    predictions = {"baseline": test[metric_key].to_numpy()}

    # KNN 的 scaler 只在训练集 fit，测试集只能 transform。
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    knn = KNeighborsRegressor(n_neighbors=min(5, len(X_train_scaled)))
    knn.fit(X_train_scaled, y_train)
    predictions["knn"] = knn.predict(X_test_scaled)

    # RandomForest 只使用训练集。
    random_forest = RandomForestRegressor(n_estimators=200, random_state=42, n_jobs=-1)
    random_forest.fit(X_train, y_train)
    predictions["random_forest"] = random_forest.predict(X_test)

    metric_results = {model_name: calculate_metrics(y_test, pred) for model_name, pred in predictions.items()}
    best_model = choose_best_model(metric_results)

    model_slug = slugify(farm_index)
    prefix = f"{model_slug}_{metric_key}"
    knn_model_path = MODEL_DIR / f"{prefix}_knn.joblib"
    knn_scaler_path = MODEL_DIR / f"{prefix}_knn_scaler.joblib"
    rf_model_path = MODEL_DIR / f"{prefix}_random_forest.joblib"
    joblib.dump({"model": knn, "feature_columns": feature_columns, "target": metric_key, "farm_name": farm_name}, knn_model_path)
    joblib.dump(scaler, knn_scaler_path)
    joblib.dump({"model": random_forest, "feature_columns": feature_columns, "target": metric_key, "farm_name": farm_name}, rf_model_path)

    registry_models = {
        "knn": {"model_file": str(knn_model_path.relative_to(PROJECT_ROOT)), "scaler_file": str(knn_scaler_path.relative_to(PROJECT_ROOT))},
        "random_forest": {"model_file": str(rf_model_path.relative_to(PROJECT_ROOT)), "scaler_file": None},
        "baseline": {"model_file": None, "scaler_file": None},
    }
    final_prediction = predictions[best_model]
    return metric_results, best_model, final_prediction, registry_models


def create_plot(farm_index: int, metric_key: str, farm_data: pd.DataFrame, best_prediction: np.ndarray) -> None:
    """为一个养殖场和一个指标单独生成真实值/最终预测值图。"""
    total_count = len(farm_data)
    train_count = int(total_count * 0.8)
    test = farm_data.sort_values("datetime").reset_index(drop=True).iloc[train_count:]
    plt.figure(figsize=(13, 5))
    plt.plot(test["target_time"], test[f"target_{metric_key}"].to_numpy(), label="True", linewidth=1.7, color="#1f77b4")
    plt.plot(test["target_time"], best_prediction, label="Selected model prediction", linewidth=1.2, color="#ff7f0e")
    plt.title(f"{metric_key} Prediction - Farm {farm_index}")
    plt.xlabel("Time")
    plt.ylabel(metric_key)
    plt.legend()
    plt.grid(alpha=0.25)
    plt.gcf().autofmt_xdate()
    plt.tight_layout()
    plt.savefig(PLOT_DIR / f"farm{farm_index:02d}_{metric_key}.png", dpi=160)
    plt.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="训练六项水质指标的下一监测时刻预测模型")
    parser.add_argument("--csv", type=Path, default=DEFAULT_CSV_PATH, help="CSV 文件路径")
    args = parser.parse_args()

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    PLOT_DIR.mkdir(parents=True, exist_ok=True)
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

    feature_data, missing_report, feature_columns = build_features(raw_data, mapping)
    print("\n缺失值检查：")
    for key, count in missing_report.items():
        print(f"  {key}: {count}")
    print(f"构造滞后特征后可用数据量：{len(feature_data)}")
    print(f"输入特征数量：{len(feature_columns)}（六项当前值 + hour/month + 六项指标 lag1/2/3/5）")

    farm_names = sorted(feature_data["farm_name"].dropna().unique().tolist())
    all_metrics: dict[str, dict[str, dict[str, dict[str, float]]]] = {}
    all_predictions: dict[str, dict[str, list[float] | str]] = {}
    model_summary: dict[str, dict[str, str]] = {}
    model_registry: dict[str, dict[str, dict]] = {}
    model_metrics_rows: list[dict] = []

    for farm_index, farm_name in enumerate(farm_names, start=1):
        farm_data = feature_data[feature_data["farm_name"] == farm_name].sort_values("datetime").reset_index(drop=True)
        total_count = len(farm_data)
        train_count = int(total_count * 0.8)
        test_count = total_count - train_count
        train = farm_data.iloc[:train_count]
        test = farm_data.iloc[train_count:]
        time_ranges = {
            "train_start": train["datetime"].min().strftime("%Y-%m-%d %H:%M:%S"),
            "train_end": train["datetime"].max().strftime("%Y-%m-%d %H:%M:%S"),
            "test_start": test["datetime"].min().strftime("%Y-%m-%d %H:%M:%S"),
            "test_end": test["datetime"].max().strftime("%Y-%m-%d %H:%M:%S"),
        }
        print(f"\n养殖场：{farm_name}")
        print(f"总数据量：{total_count}，训练集：{train_count}，测试集：{test_count}")
        print(f"训练集时间范围：{time_ranges['train_start']} 至 {time_ranges['train_end']}")
        print(f"测试集时间范围：{time_ranges['test_start']} 至 {time_ranges['test_end']}")
        print(f"时间泄漏检查：{test['datetime'].min() > train['datetime'].max()}")

        all_metrics[farm_name] = {}
        all_predictions[farm_name] = {"监测时间": [value.strftime("%Y-%m-%d %H:%M:%S") for value in test["target_time"]]}
        model_summary[farm_name] = {}
        model_registry[farm_name] = {}

        for metric_key in METRIC_KEYS:
            metric_results, best_model, best_prediction, registry_models = train_one_target(
                farm_name, farm_data, farm_index, metric_key, feature_columns, time_ranges
            )
            all_metrics[farm_name][METRIC_LABELS[metric_key]] = metric_results
            model_summary[farm_name][METRIC_LABELS[metric_key]] = best_model
            model_registry[farm_name][METRIC_LABELS[metric_key]] = {
                "metric_key": metric_key,
                "final_model": best_model,
                "feature_columns": feature_columns,
                "models": registry_models,
            }
            all_predictions[farm_name][f"真实{METRIC_OUTPUT_NAMES[metric_key]}"] = test[f"target_{metric_key}"].to_numpy().tolist()
            all_predictions[farm_name][f"预测{METRIC_OUTPUT_NAMES[metric_key]}"] = best_prediction.tolist()
            create_plot(farm_index, metric_key, farm_data, best_prediction)

            for model_name, values in metric_results.items():
                model_metrics_rows.append({
                    "养殖场": farm_name,
                    "预测指标": METRIC_LABELS[metric_key],
                    "模型": model_name,
                    "MAE": values["mae"],
                    "RMSE": values["rmse"],
                    "R2": values["r2"],
                    "训练集数量": train_count,
                    "测试集数量": test_count,
                    "训练开始时间": time_ranges["train_start"],
                    "训练结束时间": time_ranges["train_end"],
                    "测试开始时间": time_ranges["test_start"],
                    "测试结束时间": time_ranges["test_end"],
                })

    # 统一整理预测 CSV，按养殖场和预测目标时间排序。
    prediction_rows = []
    for farm_name, values in all_predictions.items():
        row_count = len(values["监测时间"])
        for row_index in range(row_count):
            row = {"养殖场": farm_name, "监测时间": values["监测时间"][row_index]}
            for metric_key in METRIC_KEYS:
                metric_label = METRIC_OUTPUT_NAMES[metric_key]
                row[f"真实{metric_label}"] = values[f"真实{metric_label}"][row_index]
                row[f"预测{metric_label}"] = values[f"预测{metric_label}"][row_index]
                row[f"{metric_label}_model"] = model_summary[farm_name][metric_label]
            prediction_rows.append(row)
    predictions = pd.DataFrame(prediction_rows).sort_values(["养殖场", "监测时间"]).reset_index(drop=True)
    numeric_columns = [column for column in predictions.columns if column.startswith("真实") or column.startswith("预测")]
    if predictions[numeric_columns].isna().any().any() or np.isinf(predictions[numeric_columns].to_numpy(dtype=float)).any():
        raise ValueError("predictions_all.csv 中发现 NaN 或 inf。")
    predictions.to_csv(OUTPUT_DIR / "predictions_all.csv", index=False, encoding="utf-8-sig")

    metrics_csv = pd.DataFrame(model_metrics_rows)
    metrics_csv.to_csv(OUTPUT_DIR / "model_metrics.csv", index=False, encoding="utf-8-sig")
    with (OUTPUT_DIR / "metrics_all.json").open("w", encoding="utf-8") as file:
        json.dump(all_metrics, file, ensure_ascii=False, indent=2)
    with (OUTPUT_DIR / "model_summary.json").open("w", encoding="utf-8") as file:
        json.dump(model_summary, file, ensure_ascii=False, indent=2)
    with (MODEL_DIR / "model_registry.json").open("w", encoding="utf-8") as file:
        json.dump(model_registry, file, ensure_ascii=False, indent=2)
    with (MODEL_DIR / "feature_columns_all.json").open("w", encoding="utf-8") as file:
        json.dump({"feature_columns": feature_columns, "target_metrics": METRIC_KEYS, "raw_field_mapping": mapping, "lag_steps": LAG_STEPS, "time_features": TIME_FEATURES}, file, ensure_ascii=False, indent=2)

    print("\n六指标模型评价结果：")
    print(f"{'养殖场':<22}{'指标':<12}{'模型':<16}{'MAE':>10}{'RMSE':>10}{'R2':>10}")
    print("-" * 84)
    for row in model_metrics_rows:
        print(f"{row['养殖场']:<22}{row['预测指标']:<12}{row['模型']:<16}{row['MAE']:>10.4f}{row['RMSE']:>10.4f}{row['R2']:>10.4f}")

    print("\n最终模型选择：")
    for farm_name, summary in model_summary.items():
        print(f"  {farm_name}")
        for metric_label, model_name in summary.items():
            print(f"    {metric_label}: {model_name}")

    print("\n输出文件：")
    print(f"  metrics_all.json：{OUTPUT_DIR / 'metrics_all.json'}")
    print(f"  model_metrics.csv：{OUTPUT_DIR / 'model_metrics.csv'}")
    print(f"  predictions_all.csv：{OUTPUT_DIR / 'predictions_all.csv'}")
    print(f"  model_summary.json：{OUTPUT_DIR / 'model_summary.json'}")
    print(f"  model_registry.json：{MODEL_DIR / 'model_registry.json'}")
    print(f"  plots：{PLOT_DIR}")


if __name__ == "__main__":
    main()
