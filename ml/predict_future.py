"""
使用已经训练好的六指标模型，滚动生成两个养殖场未来约 24 小时预测。

本脚本不会重新训练模型，也不会修改原始 CSV。
每一步只使用：历史真实数据 + 前面已经生成的预测数据。
输出给 Vue：public/data/future_24h_predictions.json
"""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime
from pathlib import Path

os.environ.setdefault("LOKY_MAX_CPU_COUNT", "1")

import joblib
import numpy as np
import pandas as pd

from train_models import METRIC_KEYS, METRIC_LABELS, detect_columns, parse_datetime


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CSV_PATH = PROJECT_ROOT.parent / "天津水产养殖检测数据_盐度平滑调整.csv"
REGISTRY_PATH = PROJECT_ROOT / "ml" / "models" / "model_registry.json"
OUTPUT_PATH = PROJECT_ROOT / "public" / "data" / "future_24h_predictions.json"

# JSON 对外使用短而稳定的英文键名，页面显示名称仍使用中文。
OUTPUT_KEYS = {
    "temperature": "temperature",
    "ph": "ph",
    "dissolvedOxygen": "do",
    "ammoniaNitrogen": "ammonia",
    "salinity": "salinity",
    "nitrite": "nitrite",
}


def resolve_project_path(value: str | None) -> Path | None:
    """把注册表中的相对路径转换为项目内路径，兼容 Windows 反斜杠。"""
    if not value:
        return None
    normalized = str(value).replace("\\", os.sep).replace("/", os.sep)
    path = Path(normalized)
    return path if path.is_absolute() else PROJECT_ROOT / path


def finite_number(value: object, context: str) -> float:
    """拒绝 NaN/Infinity，避免把非法值写入给 Vue 的 JSON。"""
    number = float(value)
    if not np.isfinite(number):
        raise ValueError(f"{context} 产生了 NaN 或 Infinity。")
    return round(number, 6)


def load_history(csv_path: Path) -> tuple[pd.DataFrame, dict[str, str]]:
    """读取并按养殖场、时间排序历史数据。"""
    raw_data = pd.read_csv(csv_path, encoding="utf-8-sig")
    print(f"实际字段名：{list(raw_data.columns)}")
    mapping = detect_columns(raw_data)
    data = pd.DataFrame()
    data["farm_name"] = raw_data[mapping["farm"]].astype(str).str.strip()
    data["datetime"] = parse_datetime(raw_data[mapping["date"]], raw_data[mapping["time"]])
    for metric_key in METRIC_KEYS:
        data[metric_key] = pd.to_numeric(raw_data[mapping[metric_key]], errors="coerce")

    missing = data[METRIC_KEYS + ["farm_name", "datetime"]].isna().sum()
    missing = {str(key): int(value) for key, value in missing.items() if int(value) > 0}
    if missing:
        raise ValueError(f"预测所需历史数据存在缺失值：{missing}")
    data = data.sort_values(["farm_name", "datetime"]).reset_index(drop=True)
    return data, mapping


def median_interval_hours(farm_data: pd.DataFrame) -> float:
    """根据同一养殖场相邻监测时间的中位数计算未来步长。"""
    differences = farm_data["datetime"].sort_values().diff().dt.total_seconds().div(3600)
    positive = differences[ differences > 0 ]
    if positive.empty:
        raise ValueError("无法从历史数据计算有效的监测间隔。")
    interval = float(positive.median())
    if not np.isfinite(interval) or interval <= 0:
        raise ValueError(f"计算出的监测间隔无效：{interval}")
    return interval


def get_feature_value(history: pd.DataFrame, feature_name: str, context_time: pd.Timestamp) -> float:
    """严格按照训练时的字段名生成单行特征。"""
    if feature_name in METRIC_KEYS:
        return float(history.iloc[-1][feature_name])
    if feature_name == "hour":
        return float(context_time.hour)
    if feature_name == "month":
        return float(context_time.month)

    if "_lag" in feature_name:
        metric_name, lag_text = feature_name.rsplit("_lag", 1)
        metric_name = "dissolvedOxygen" if metric_name == "DO" else metric_name
        lag = int(lag_text)
        if metric_name not in METRIC_KEYS or lag < 1 or len(history) <= lag:
            raise ValueError(f"无法为特征 {feature_name} 找到足够的过去数据。")
        return float(history.iloc[-1 - lag][metric_name])

    raise ValueError(f"模型特征列 {feature_name} 尚未实现生成逻辑。")


def load_final_model(farm_name: str, metric_label: str, registry_entry: dict) -> tuple[str, object, object | None]:
    """按注册表加载某个养殖场/指标最终模型和可选 scaler。"""
    model_name = registry_entry.get("final_model")
    if model_name == "baseline":
        return model_name, None, None
    model_info = registry_entry.get("models", {}).get(model_name)
    if not model_info:
        raise FileNotFoundError(f"{farm_name} / {metric_label} 找不到最终模型 {model_name} 的注册信息。")
    model_path = resolve_project_path(model_info.get("model_file"))
    if model_path is None or not model_path.exists():
        raise FileNotFoundError(f"找不到模型文件：{model_path}")
    bundle = joblib.load(model_path)
    model = bundle.get("model", bundle) if isinstance(bundle, dict) else bundle

    scaler = None
    scaler_path = resolve_project_path(model_info.get("scaler_file"))
    if model_name == "knn":
        if scaler_path is None or not scaler_path.exists():
            raise FileNotFoundError(f"KNN 缺少 StandardScaler 文件：{scaler_path}")
        scaler = joblib.load(scaler_path)
    print(f"加载模型：{farm_name} / {metric_label} / {model_name} -> {model_path}")
    return model_name, model, scaler


def predict_farm(farm_name: str, farm_data: pd.DataFrame, registry_farm: dict) -> dict:
    """对单个养殖场进行滚动预测，直到覆盖未来 24 小时。"""
    farm_data = farm_data.sort_values("datetime").reset_index(drop=True)
    interval = median_interval_hours(farm_data)
    last_actual_time = pd.Timestamp(farm_data.iloc[-1]["datetime"])
    feature_columns_by_metric = {}
    loaded_models = {}

    for metric_key in METRIC_KEYS:
        metric_label = METRIC_LABELS[metric_key]
        entry = registry_farm.get(metric_label)
        if not entry:
            raise KeyError(f"模型注册表中缺少 {farm_name} / {metric_label}")
        feature_columns = entry.get("feature_columns", [])
        if not feature_columns:
            raise ValueError(f"{farm_name} / {metric_label} 没有保存特征列名称。")
        feature_columns_by_metric[metric_key] = feature_columns
        loaded_models[metric_key] = load_final_model(farm_name, metric_label, entry)

    # 所有指标使用同一个未来时间轴；每个新预测点会完整加入临时序列。
    temporary_history = farm_data.copy()
    predictions = []
    horizon_hours = 0.0
    while horizon_hours < 24:
        context_time = pd.Timestamp(temporary_history.iloc[-1]["datetime"])
        next_time = context_time + pd.to_timedelta(interval, unit="h")
        horizon_hours = (next_time - last_actual_time).total_seconds() / 3600
        predicted_values: dict[str, float] = {}

        for metric_key in METRIC_KEYS:
            metric_label = METRIC_LABELS[metric_key]
            feature_columns = feature_columns_by_metric[metric_key]
            feature_row = {feature: get_feature_value(temporary_history, feature, context_time) for feature in feature_columns}
            X = pd.DataFrame([feature_row], columns=feature_columns)
            model_name, model, scaler = loaded_models[metric_key]
            if model_name == "baseline":
                value = temporary_history.iloc[-1][metric_key]
            else:
                transformed = scaler.transform(X) if model_name == "knn" else X
                value = model.predict(transformed)[0]
            predicted_values[metric_key] = finite_number(value, f"{farm_name} / {metric_label}")

        output_point = {
            "time": next_time.strftime("%Y-%m-%d %H:%M:%S"),
            "horizonHours": round(float(horizon_hours), 3),
        }
        for metric_key in METRIC_KEYS:
            output_point[OUTPUT_KEYS[metric_key]] = predicted_values[metric_key]
        predictions.append(output_point)

        # 这是滚动预测的关键：下一轮只能读取历史真实数据和刚才预测的这一行。
        next_row = {"farm_name": farm_name, "datetime": next_time, **predicted_values}
        temporary_history = pd.concat([temporary_history, pd.DataFrame([next_row])], ignore_index=True)

    last_values = {}
    for metric_key in METRIC_KEYS:
        last_values[OUTPUT_KEYS[metric_key]] = finite_number(farm_data.iloc[-1][metric_key], f"{farm_name} 最新真实值")

    return {
        "farm": farm_name,
        "lastActualTime": last_actual_time.strftime("%Y-%m-%d %H:%M:%S"),
        "lastActualValues": last_values,
        "samplingIntervalHours": round(interval, 3),
        "modelTypes": {OUTPUT_KEYS[key]: loaded_models[key][0] for key in METRIC_KEYS},
        "predictions": predictions,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="使用已训练模型生成未来约 24 小时六指标预测")
    parser.add_argument("--csv", type=Path, default=DEFAULT_CSV_PATH, help="历史 CSV 路径")
    parser.add_argument("--registry", type=Path, default=REGISTRY_PATH, help="模型注册表路径")
    parser.add_argument("--output", type=Path, default=OUTPUT_PATH, help="Vue 使用的 JSON 输出路径")
    args = parser.parse_args()

    csv_path = args.csv.resolve()
    registry_path = args.registry.resolve()
    output_path = args.output.resolve()
    if not csv_path.exists():
        raise FileNotFoundError(f"找不到历史 CSV：{csv_path}")
    if not registry_path.exists():
        raise FileNotFoundError(f"找不到模型注册表：{registry_path}")

    print(f"读取历史数据：{csv_path}")
    history, mapping = load_history(csv_path)
    registry = json.loads(registry_path.read_text(encoding="utf-8"))
    print(f"自动识别字段映射：{mapping}")

    farms = []
    for farm_name in sorted(history["farm_name"].unique().tolist()):
        if farm_name not in registry:
            raise KeyError(f"历史数据中的养殖场 {farm_name} 不在模型注册表中。")
        farm_history = history[history["farm_name"] == farm_name].copy()
        farms.append(predict_farm(farm_name, farm_history, registry[farm_name]))
        print(f"{farm_name}：历史 {len(farm_history)} 行，监测间隔中位数 {farms[-1]['samplingIntervalHours']} 小时，生成 {len(farms[-1]['predictions'])} 个未来点")

    output = {
        "generatedAt": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "forecastHours": 24,
        "farms": farms,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"预测 JSON 已生成：{output_path}")


if __name__ == "__main__":
    main()
