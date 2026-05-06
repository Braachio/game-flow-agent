interface TranscriptPanelProps {
  transcripts: string[];
}

export function TranscriptPanel({ transcripts }: TranscriptPanelProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 h-96 flex flex-col">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Transcripts</h2>
      <div className="flex-1 overflow-y-auto space-y-2">
        {transcripts.length === 0 ? (
          <p className="text-gray-500">No transcripts yet. Start listening!</p>
        ) : (
          transcripts.map((t, i) => (
            <div key={i} className="bg-gray-700 rounded px-3 py-2 text-sm">
              {t}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
