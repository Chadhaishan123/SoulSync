const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from", "had", "has", "have",
  "i", "in", "is", "it", "me", "my", "of", "on", "or", "our", "that", "the", "their", "then",
  "there", "they", "this", "to", "was", "we", "were", "with", "you", "your"
]);

const SYMBOLS = {
  water: "emotions, change, and the need to move with what you feel",
  ocean: "large emotions or a situation that feels bigger than usual",
  house: "your inner world, safety, family, or personal boundaries",
  room: "a specific part of your life or identity asking for attention",
  school: "learning, pressure, comparison, or unfinished expectations",
  exam: "evaluation, performance pressure, or fear of being unprepared",
  falling: "loss of control, uncertainty, or a need for support",
  flying: "freedom, perspective, ambition, or a wish to rise above limits",
  chase: "avoidance, pressure, or something you may not want to face yet",
  running: "urgency, escape, stamina, or moving toward a goal",
  snake: "fear, transformation, mistrust, or hidden tension",
  fire: "anger, intensity, transformation, or something that needs care",
  baby: "new beginnings, vulnerability, or something tender developing",
  death: "ending, transition, release, or fear of change",
  teeth: "confidence, communication, appearance, or fear of losing control",
  train: "direction, timing, momentum, or feeling carried by life",
  car: "agency, control, pace, or choices about where you are going",
  phone: "connection, missed communication, or wanting to be heard",
  mirror: "self-image, identity, or honest reflection",
  forest: "uncertainty, exploration, instinct, or needing quiet",
  door: "choice, opportunity, privacy, or a boundary",
  bridge: "transition, repair, or crossing from one phase to another"
};

const EMOTIONS = {
  anxiety: ["afraid", "anxious", "panic", "worried", "scared", "fear", "terrified", "nervous", "trapped"],
  sadness: ["sad", "crying", "alone", "lost", "empty", "grief", "dark", "hurt", "missing"],
  anger: ["angry", "rage", "fight", "shout", "fire", "attack", "furious", "frustrated"],
  joy: ["happy", "peaceful", "calm", "bright", "laugh", "love", "safe", "free", "flying"],
  curiosity: ["search", "found", "door", "hidden", "mystery", "forest", "new", "unknown", "explore"]
};

const THEMES = {
  pressure: ["exam", "late", "deadline", "school", "work", "fail", "unprepared", "crowd"],
  control: ["falling", "driving", "car", "brake", "stuck", "trapped", "lost", "chase"],
  connection: ["phone", "friend", "family", "mother", "father", "partner", "message", "voice"],
  transition: ["door", "bridge", "train", "death", "baby", "moving", "new", "leaving"],
  safety: ["house", "room", "dark", "locked", "safe", "hiding", "window", "key"]
};

const DL_WEIGHTS = {
  anxiety: [1.1, -0.2, 0.9, 0.6, 0.3],
  sadness: [0.8, 1.1, -0.1, 0.2, 0.5],
  anger: [0.2, 0.1, 1.2, 0.4, -0.2],
  joy: [-0.7, -0.5, -0.4, 0.2, 1.2],
  curiosity: [0.1, 0.3, 0.1, 1.1, 0.4]
};

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((token) => token && !STOP_WORDS.has(token));
}

function countMatches(tokens, words) {
  const tokenSet = new Set(tokens);
  return words.reduce((count, word) => count + (tokenSet.has(word) ? 1 : 0), 0);
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-value));
}

function normalizeScores(scores) {
  const total = Object.values(scores).reduce((sum, score) => sum + score, 0) || 1;
  return Object.fromEntries(
    Object.entries(scores).map(([key, score]) => [key, Math.round((score / total) * 100)])
  );
}

function topEntries(record, limit = 3) {
  return Object.entries(record)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .filter(([, value]) => value > 0);
}

function analyzeDream(text) {
  const tokens = tokenize(text);
  const wordCount = tokens.length;
  const symbolHits = Object.entries(SYMBOLS)
    .filter(([symbol]) => tokens.includes(symbol))
    .map(([symbol, meaning]) => ({ symbol, meaning }));

  const emotionCounts = Object.fromEntries(
    Object.entries(EMOTIONS).map(([emotion, words]) => [emotion, countMatches(tokens, words)])
  );
  const themeCounts = Object.fromEntries(
    Object.entries(THEMES).map(([theme, words]) => [theme, countMatches(tokens, words)])
  );

  const featureVector = [
    emotionCounts.anxiety + themeCounts.control,
    emotionCounts.sadness,
    emotionCounts.anger,
    themeCounts.transition + emotionCounts.curiosity,
    emotionCounts.joy
  ].map((value) => Math.min(value / Math.max(wordCount / 12, 1), 1));

  const neuralScores = Object.fromEntries(
    Object.entries(DL_WEIGHTS).map(([label, weights]) => {
      const activation = weights.reduce((sum, weight, index) => sum + weight * featureVector[index], 0);
      return [label, sigmoid(activation)];
    })
  );

  const emotionScores = normalizeScores(
    Object.fromEntries(
      Object.entries(emotionCounts).map(([emotion, count]) => [emotion, count + neuralScores[emotion]])
    )
  );
  const dominantEmotion = topEntries(emotionScores, 1)[0]?.[0] || "reflective";
  const topThemes = topEntries(themeCounts).map(([theme]) => theme);

  const intensity = Math.min(
    10,
    Math.max(1, Math.round((symbolHits.length + topEntries(emotionCounts).length + topThemes.length + wordCount / 35) * 1.35))
  );

  const interpretation = buildInterpretation(dominantEmotion, topThemes, symbolHits, intensity);

  return {
    wordCount,
    dominantEmotion,
    emotionScores,
    topThemes,
    symbols: symbolHits.slice(0, 6),
    intensity,
    interpretation,
    modelNotes: {
      nlp: "Tokenization, stop-word filtering, keyword extraction, and dream-symbol entity matching.",
      ml: "Weighted scoring classifies emotional tone, themes, and intensity from extracted features.",
      dl: "A small neural-style dense layer with sigmoid activations refines the emotion probabilities."
    }
  };
}

function buildInterpretation(dominantEmotion, topThemes, symbols, intensity) {
  const themeText = topThemes.length ? topThemes.join(", ") : "self-awareness";
  const symbolText = symbols.length
    ? ` Symbols like ${symbols.slice(0, 3).map((item) => item.symbol).join(", ")} may point toward ${symbols[0].meaning}.`
    : "";
  const tone = intensity >= 7 ? "This dream appears emotionally vivid" : "This dream appears moderately reflective";

  return `${tone}, with ${dominantEmotion} as the strongest emotional signal and themes around ${themeText}.${symbolText} Consider what part of waking life feels similar, then write one practical support step you can take today.`;
}

module.exports = {
  analyzeDream
};
