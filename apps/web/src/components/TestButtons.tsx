interface TestButtonsProps {
  onSend: (transcript: string) => void;
}

const TEST_PHRASES = [
  { label: "나이스", transcript: "나이스" },
  { label: "와 대박", transcript: "와 대박" },
  { label: "아 망했다", transcript: "아 망했다" },
  { label: "클립 저장", transcript: "클립 저장" },
];

export function TestButtons({ onSend }: TestButtonsProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-xl font-semibold mb-3">Manual Test</h2>
      <div className="flex flex-wrap gap-2">
        {TEST_PHRASES.map(({ label, transcript }) => (
          <button
            key={label}
            onClick={() => onSend(transcript)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded text-sm font-medium transition-colors"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
