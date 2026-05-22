const CRISIS_PATTERNS = [
  "suicide", "kill myself", "end my life", "self harm", "hurt myself", "not want to live",
  "can't go on", "cannot go on", "no reason to live", "overdose"
];

const RECOMMENDATION_RULES = [
  { match: ["anxious", "anxiety", "panic", "worried"], category: "Anxiety" },
  { match: ["sleep", "tired", "insomnia", "restless"], category: "Sleep" },
  { match: ["stress", "deadline", "work", "exam", "overwhelmed"], category: "Stress" },
  { match: ["feel", "emotion", "journal", "aware"], category: "Self-awareness" }
];

function detectCrisis(text) {
  const normalized = String(text || "").toLowerCase();
  const matches = CRISIS_PATTERNS.filter((phrase) => normalized.includes(phrase));

  return {
    risk: matches.length >= 2 ? "high" : matches.length === 1 ? "elevated" : "low",
    matches,
    message: matches.length
      ? "This text contains possible crisis language. Encourage immediate human support and keep emergency options visible."
      : "No crisis keywords were detected by the local safety screen."
  };
}

function predictMood(moods) {
  const recent = [...moods]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  if (!recent.length) {
    return {
      predictedIntensity: 6,
      trend: "not enough data",
      confidence: "low",
      suggestion: "Log a few mood check-ins to unlock a more useful prediction."
    };
  }

  const average = recent.reduce((sum, item) => sum + Number(item.intensity || 0), 0) / recent.length;
  const latest = Number(recent[0].intensity || average);
  const oldest = Number(recent[recent.length - 1].intensity || average);
  const predictedIntensity = Math.max(1, Math.min(10, Math.round((average * 0.65) + (latest * 0.35))));
  const trend = latest > oldest ? "improving" : latest < oldest ? "needs attention" : "steady";

  return {
    predictedIntensity,
    trend,
    confidence: recent.length >= 5 ? "medium" : "early",
    suggestion: trend === "needs attention"
      ? "Plan one low-effort support action today, like a short walk, a meal, or messaging someone trusted."
      : "Keep noticing what supports this pattern and repeat the smallest helpful routine."
  };
}

function recommendResources(resources, signals) {
  const text = String(signals || "").toLowerCase();
  const categories = RECOMMENDATION_RULES
    .filter((rule) => rule.match.some((word) => text.includes(word)))
    .map((rule) => rule.category);

  const selected = resources.filter((resource) => categories.includes(resource.category));
  return (selected.length ? selected : resources).slice(0, 3);
}

function matchTherapists(therapists, concern = "", language = "", mode = "") {
  const concernText = String(concern).toLowerCase();
  const languageText = String(language).toLowerCase();
  const modeText = String(mode).toLowerCase();

  return therapists
    .map((therapist) => {
      const specialty = therapist.specialty.toLowerCase();
      const therapistLanguage = therapist.language.toLowerCase();
      const therapistMode = therapist.mode.toLowerCase();
      let score = 30;

      concernText.split(/\s+/).filter(Boolean).forEach((word) => {
        if (specialty.includes(word)) score += 14;
      });
      if (languageText && therapistLanguage.includes(languageText)) score += 22;
      if (modeText && therapistMode.includes(modeText)) score += 16;

      return {
        ...therapist,
        matchScore: Math.min(score, 100),
        matchReason: `Matched on ${therapist.specialty.toLowerCase().includes(concernText.split(/\s+/)[0] || "___") ? "specialty" : "availability and fit"} signals.`
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
}

function buildInsights(db, userRecords) {
  const moods = userRecords.moods;
  const journals = userRecords.journal;
  const dreams = userRecords.dreams;
  const latestText = [
    moods[0]?.mood,
    moods[0]?.trigger,
    moods[0]?.note,
    journals[0]?.body,
    dreams[0]?.dream
  ].filter(Boolean).join(" ");

  return {
    moodPrediction: predictMood(moods),
    recommendedResources: recommendResources(db.resources, latestText),
    crisisScreen: detectCrisis(latestText),
    patternSummary: {
      moodEntries: moods.length,
      journalEntries: journals.length,
      dreamEntries: dreams.length,
      recurringDreamEmotion: dreams[0]?.analysis?.dominantEmotion || "not enough data"
    }
  };
}

module.exports = {
  buildInsights,
  detectCrisis,
  matchTherapists,
  predictMood,
  recommendResources
};
