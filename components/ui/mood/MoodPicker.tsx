
const moods = [
    "😊 Happy",
    "😐 Neutral",
    "😔 Sad",
    "😞 Lonely",
    "😣 Anxious",
    "😴 Tired",
];

export default function MoodPicker() {
    return (
        <div className="grid grid-cols-2 gap-3 mt-6">
            {moods.map((mood) => (
                <button
                    key={mood}
                    className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-2xl p-4 transition"
                >
                    {mood}
                </button>
            ))}
        </div>
    );
}