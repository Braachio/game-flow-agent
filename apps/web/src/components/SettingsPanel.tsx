"use client";

import { useState, useEffect, useCallback } from "react";

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:3001";

interface Config {
  confidenceThreshold: number;
  cooldownMs: number;
  duplicateWindowMs: number;
  clipCategories: string[];
  defaultClipDuration: number;
  maxClipDuration: number;
  sustainedThreshold: number;
  silenceBoostMinSec: number;
}

export function SettingsPanel() {
  const [config, setConfig] = useState<Config | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${AGENT_URL}/settings`);
        if (res.ok) setConfig(await res.json());
      } catch {}
    })();
  }, []);

  const save = useCallback(async (partial: Partial<Config>) => {
    setSaving(true);
    try {
      const res = await fetch(`${AGENT_URL}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partial),
      });
      if (res.ok) setConfig(await res.json());
    } catch {} finally {
      setSaving(false);
    }
  }, []);

  const reset = useCallback(async () => {
    try {
      const res = await fetch(`${AGENT_URL}/settings/reset`, { method: "POST" });
      if (res.ok) setConfig(await res.json());
    } catch {}
  }, []);

  if (!config) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Settings</h2>
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Settings</h2>
        <button
          onClick={reset}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Reset
        </button>
      </div>
      <div className="space-y-3 text-sm">
        <SettingSlider
          label="Confidence Threshold"
          value={config.confidenceThreshold}
          min={0.3} max={0.95} step={0.05}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => save({ confidenceThreshold: v })}
          disabled={saving}
        />
        <SettingSlider
          label="Cooldown"
          value={config.cooldownMs}
          min={1000} max={15000} step={1000}
          format={(v) => `${v / 1000}s`}
          onChange={(v) => save({ cooldownMs: v })}
          disabled={saving}
        />
        <SettingSlider
          label="Duplicate Window"
          value={config.duplicateWindowMs}
          min={1000} max={10000} step={500}
          format={(v) => `${v / 1000}s`}
          onChange={(v) => save({ duplicateWindowMs: v })}
          disabled={saving}
        />
        <SettingSlider
          label="Default Clip Duration"
          value={config.defaultClipDuration}
          min={5} max={45} step={5}
          format={(v) => `${v}s`}
          onChange={(v) => save({ defaultClipDuration: v })}
          disabled={saving}
        />
        <SettingSlider
          label="Sustained Threshold"
          value={config.sustainedThreshold}
          min={2} max={6} step={1}
          format={(v) => `${v}x`}
          onChange={(v) => save({ sustainedThreshold: v })}
          disabled={saving}
        />
        <SettingSlider
          label="Silence Boost Min"
          value={config.silenceBoostMinSec}
          min={5} max={30} step={5}
          format={(v) => `${v}s`}
          onChange={(v) => save({ silenceBoostMinSec: v })}
          disabled={saving}
        />
        <div>
          <h3 className="text-gray-400 font-medium mb-1">Clip Categories</h3>
          <div className="flex flex-wrap gap-1.5">
            {["excitement", "victory", "surprise", "frustration", "defeat"].map((cat) => {
              const active = config.clipCategories.includes(cat);
              return (
                <button
                  key={cat}
                  onClick={() => {
                    const next = active
                      ? config.clipCategories.filter((c) => c !== cat)
                      : [...config.clipCategories, cat];
                    save({ clipCategories: next });
                  }}
                  disabled={saving}
                  className={`px-2 py-0.5 rounded text-xs transition-colors ${
                    active
                      ? "bg-green-800 text-green-200"
                      : "bg-gray-700 text-gray-500"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingSlider({
  label, value, min, max, step, format, onChange, disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <h3 className="text-gray-400 font-medium">{label}</h3>
        <span className="text-white text-xs">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="w-full h-1.5 bg-gray-700 rounded appearance-none cursor-pointer accent-blue-500 disabled:opacity-50"
      />
    </div>
  );
}
