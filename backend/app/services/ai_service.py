import os
from typing import Dict, Any, List

class AIService:
    def __init__(self):
        self.emotion_pipeline = None
        self.sentiment_pipeline = None
        self.initialized = False
        
    def initialize_models(self):
        if self.initialized:
            return
        
        try:
            from transformers import pipeline
            # Load a standard 6-class emotion model
            self.emotion_pipeline = pipeline(
                "text-classification", 
                model="bhadresh-savani/distilbert-base-uncased-emotion", 
                top_k=None
            )
            # Load standard SST-2 sentiment model
            self.sentiment_pipeline = pipeline(
                "sentiment-analysis", 
                model="distilbert-base-uncased-finetuned-sst-2-english"
            )
            self.initialized = True
            print("AI models initialized successfully.")
        except Exception as e:
            print(f"Failed to load Transformers pipelines (using fallback engine): {e}")
            self.emotion_pipeline = None
            self.sentiment_pipeline = None
            self.initialized = True

    def analyze_text(self, text: str) -> Dict[str, Any]:
        # Lazy initialization
        if not self.initialized:
            self.initialize_models()
            
        if self.emotion_pipeline is not None and self.sentiment_pipeline is not None:
            try:
                # 1. Emotion analysis
                emotion_preds = self.emotion_pipeline(text)[0]
                probs = {p["label"]: round(p["score"], 4) for p in emotion_preds}
                dominant = max(probs, key=probs.get)
                
                # Map standard emotion labels to user blueprint primary emotions
                # standard: sadness, joy, love, anger, fear, surprise
                emotion_map = {
                    "sadness": "Sad",
                    "joy": "Happy",
                    "love": "Happy",
                    "anger": "Angry",
                    "fear": "Anxious",
                    "surprise": "Neutral",
                    "neutral": "Neutral"
                }
                mapped_dominant = emotion_map.get(dominant.lower(), "Neutral")
                
                # 2. Sentiment analysis
                sentiment_pred = self.sentiment_pipeline(text)[0]
                label = sentiment_pred["label"]  # POSITIVE / NEGATIVE
                score = sentiment_pred["score"]
                sentiment_score = score if label == "POSITIVE" else -score
                
                model_version = "distilbert-base-emotion-v1"
            except Exception as e:
                print(f"Transformers pipeline inference failed: {e}")
                return self._fallback_analyze(text)
        else:
            return self._fallback_analyze(text)

        # 3. Theme extraction
        themes = self._extract_themes(text)
        
        # 4. Summary
        summary = self._generate_summary(text)
        
        return {
            "sentiment_score": float(sentiment_score),
            "dominant_emotion": mapped_dominant,
            "emotion_probabilities": probs,
            "themes": themes,
            "summary": summary,
            "model_version": model_version
        }

    def _fallback_analyze(self, text: str) -> Dict[str, Any]:
        """Simple keyword-based emotion and sentiment analysis as a fallback."""
        text_lower = text.lower()
        
        # Simple sentiment scoring
        pos_words = ["happy", "good", "great", "excellent", "calm", "excited", "love", "wonderful", "relaxed", "glad"]
        neg_words = ["sad", "bad", "angry", "anxious", "overwhelmed", "stressed", "tired", "worry", "fear", "hate", "difficult", "heavy", "lonely"]
        
        pos_count = sum(1 for w in pos_words if w in text_lower)
        neg_count = sum(1 for w in neg_words if w in text_lower)
        
        total = pos_count + neg_count
        sentiment_score = 0.0
        if total > 0:
            sentiment_score = (pos_count - neg_count) / total
            
        # Emotion detection heuristics
        emotions = {
            "Happy": ["happy", "glad", "joy", "excited", "love", "great", "wonderful", "good"],
            "Sad": ["sad", "unhappy", "cry", "lonely", "grief", "heavy"],
            "Anxious": ["anxious", "worry", "nervous", "stressed", "overwhelmed", "scared", "fear"],
            "Angry": ["angry", "mad", "annoyed", "frustrated", "hate", "irritated"],
            "Calm": ["calm", "relaxed", "peaceful", "quiet", "serene"],
            "Neutral": []
        }
        
        scores = {e: 0 for e in emotions}
        for emotion, keywords in emotions.items():
            scores[emotion] = sum(1 for w in keywords if w in text_lower)
            
        dominant_emotion = "Neutral"
        max_score = 0
        for emotion, score in scores.items():
            if score > max_score:
                max_score = score
                dominant_emotion = emotion
                
        # Fill standard probabilities
        total_scores = sum(scores.values())
        if total_scores > 0:
            probs = {e: round(s / total_scores, 2) for e, s in scores.items()}
        else:
            probs = {"Happy": 0.16, "Sad": 0.16, "Anxious": 0.16, "Angry": 0.16, "Calm": 0.16, "Neutral": 0.2}
            
        themes = self._extract_themes(text)
        summary = self._generate_summary(text)
        
        return {
            "sentiment_score": float(sentiment_score),
            "dominant_emotion": dominant_emotion,
            "emotion_probabilities": probs,
            "themes": themes,
            "summary": summary,
            "model_version": "lexicon-fallback-1.0"
        }

    def _extract_themes(self, text: str) -> List[str]:
        text_lower = text.lower()
        theme_keywords = {
            "Workload": ["work", "job", "career", "office", "boss", "project", "meeting"],
            "Deadlines": ["deadline", "exam", "test", "due", "schedule", "calendar", "late", "rush"],
            "Family & Friends": ["family", "friend", "mom", "dad", "sister", "brother", "girlfriend", "boyfriend", "husband", "wife", "social"],
            "Health & Exercise": ["gym", "workout", "exercise", "run", "walk", "health", "sick", "doctor", "pain", "fit"],
            "Sleep & Fatigue": ["sleep", "tired", "awake", "insomnia", "bed", "rest", "energy", "exhausted"],
            "Hobbies & Recreation": ["book", "movie", "game", "hike", "travel", "cooking", "music", "hobby"]
        }
        extracted = []
        for theme, words in theme_keywords.items():
            if any(w in text_lower for w in words):
                extracted.append(theme)
        return extracted if extracted else ["General reflection"]

    def _generate_summary(self, text: str) -> str:
        sentences = text.split(". ")
        if len(sentences) <= 2:
            return text
        return ". ".join(sentences[:2]) + "..."

    def generate_chat_response(self, user_message: str, history: List[Dict[str, str]], trends_summary: str) -> str:
        """AI Wellness Companion response generator. Adheres strictly to safety guidelines."""
        msg_lower = user_message.lower()
        
        # Handle suicidal/crisis ideation
        crisis_keywords = ["kill myself", "suicide", "want to die", "end my life", "harm myself"]
        if any(kw in msg_lower for kw in crisis_keywords):
            return (
                "It sounds like you're going through a very difficult time. Please know that you are not alone, "
                "and there are people who want to support you. You can connect with compassionate professionals "
                "24/7 at the Suicide & Crisis Lifeline by calling or texting 988 (USA) or visiting your local emergency room."
            )
            
        # Clinical questions responses
        diagnostic_keywords = ["diagnose", "depression", "anxiety", "adhd", "bipolar", "disorder", "medical advice"]
        is_diagnostic = any(kw in msg_lower for kw in diagnostic_keywords)
        
        reply = ""
        if is_diagnostic:
            reply += (
                "Please note that I am a wellness companion, not a medical professional. I cannot diagnose mental health "
                "conditions or provide medical advice. If you have concerns, I highly recommend speaking with a licensed "
                "mental health professional.\n\n"
            )
            
        # Core conversation logic
        if "why" in msg_lower and ("mood" in msg_lower or "feeling" in msg_lower or "sad" in msg_lower or "stressed" in msg_lower):
            reply += (
                f"Based on your recent logged entries, {trends_summary}. These are observed correlations in your "
                "self-reported data and do not establish a clinical cause. What kinds of activities have felt helpful to you recently?"
            )
        elif "recommend" in msg_lower or "activity" in msg_lower or "help" in msg_lower:
            reply += (
                "When feeling overwhelmed or low, small steps make a big difference. I recommend trying a 2-minute breathing "
                "exercise to reset, or a short walk to get a change of environment. Both of these have shown positive outcomes "
                "for similar patterns."
            )
        elif "hello" in msg_lower or "hi" in msg_lower:
            reply += "Hello! I'm your SoulSync wellness companion. How are you feeling today, and what's on your mind?"
        else:
            reply += (
                "Thank you for sharing that with me. Reflecting on these feelings is a valuable part of understanding "
                "your wellness patterns. Would you like to explore this further, or maybe try a quick reflection exercise?"
            )
            
        return reply

ai_service = AIService()
