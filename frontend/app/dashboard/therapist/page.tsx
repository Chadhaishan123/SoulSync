"use client"

import React, { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  HeartHandshake,
  Send,
  AlertTriangle,
  User,
  Shield,
  Stethoscope,
  Sparkles,
  Phone,
  RefreshCw,
  CalendarCheck,
  CheckCircle2,
} from "lucide-react"
import Card from "@/components/ui/Card"
import Button from "@/components/ui/Button"
import Badge from "@/components/ui/Badge"
import toast from "react-hot-toast"

interface TherapistMessage {
  id: string
  role: "therapist" | "user"
  text: string
  distortionHint?: string
  toolSuggestion?: string
}

const CBT_DISTORTIONS: Record<string, { name: string; advice: string }> = {
  catastrophizing: {
    name: "Catastrophizing",
    advice: "Expecting the worst-case scenario. Ask yourself: 'What is the most realistic outcome?'",
  },
  allOrNothing: {
    name: "All-or-Nothing Thinking",
    advice: "Viewing situations in black-and-white. Notice shades of gray and partial successes.",
  },
  mindReading: {
    name: "Mind Reading",
    advice: "Assuming you know what others think without concrete evidence.",
  },
  emotionalReasoning: {
    name: "Emotional Reasoning",
    advice: "'I feel it, therefore it must be true.' Feelings are real, but they are not facts.",
  },
  shouldStatements: {
    name: "Should Statements",
    advice: "Rigid demands ('I should', 'I must') that create guilt. Replace with 'I would prefer to'.",
  },
}

function generateTherapistResponse(
  currentText: string,
  history: TherapistMessage[]
): { reply: string; distortionHint?: string; toolSuggestion?: string } {
  const lower = currentText.toLowerCase().trim()
  const historyText = history.map((m) => m.text.toLowerCase()).join(" ")
  const userMessages = history.filter((m) => m.role === "user")
  const turnCount = userMessages.length

  // Find last therapist message to understand prompt continuity
  const therapistMessages = history.filter((m) => m.role === "therapist")
  const lastTherapistMsg =
    therapistMessages.length > 0
      ? therapistMessages[therapistMessages.length - 1].text.toLowerCase()
      : ""

  // 1. Immediate Crisis Check
  if (
    lower.includes("suicid") ||
    lower.includes("kill myself") ||
    lower.includes("end my life") ||
    lower.includes("hurt myself") ||
    lower.includes("want to die")
  ) {
    return {
      reply:
        "I hear how much pain you are holding right now, but please know that you do not have to carry this alone. Your life is irreplaceable.\n\n" +
        "Please reach out immediately to a human professional. You can call the free, confidential 24/7 lifeline right now at 14416 (Tele-MANAS) or 988. " +
        "Click the emergency buttons above to connect immediately with clinical support.",
    }
  }

  // Detect Body Parts in user's response
  const bodyPartMatch = [
    "chest",
    "throat",
    "stomach",
    "head",
    "jaw",
    "shoulders",
    "neck",
    "belly",
    "back",
    "hands",
  ].find((bp) => lower.includes(bp))

  // Check if previous therapist asked about bodily location/tension
  const wasAskedBodyLocation =
    lastTherapistMsg.includes("body holding tension") ||
    lastTherapistMsg.includes("where is your body") ||
    lastTherapistMsg.includes("feel it in your body") ||
    lastTherapistMsg.includes("senses")

  if (bodyPartMatch && (wasAskedBodyLocation || lower.length < 50)) {
    return {
      toolSuggestion: "Somatic Attunement",
      reply:
        `Thank you for noticing that. Holding tension in your ${bodyPartMatch} is your sympathetic nervous system's instinctual way of bracing against threat. ` +
        `Let's do a somatic release right now:\n\n` +
        `1. Place a gentle, warm hand over your ${bodyPartMatch}.\n` +
        `2. Take a slow inhale through your nose for 4 counts, sending the breath directly toward that sensation.\n` +
        `3. Exhale with a soft, audible sigh through your mouth for 6 counts.\n\n` +
        `Allow your ${bodyPartMatch} to soften just 5%. As that physical grip loosens, what thought or worry is driving that physical alarm?`,
    }
  }

  // 2. Frustration / Skepticism / Feeling Stuck
  if (
    lower.includes("tried that") ||
    lower.includes("doesn't work") ||
    lower.includes("doesnt work") ||
    lower.includes("nothing works") ||
    lower.includes("pointless") ||
    lower.includes("useless") ||
    lower.includes("tired of trying") ||
    lower.includes("stuck") ||
    lower.includes("hate this")
  ) {
    return {
      toolSuggestion: "Radical Acceptance",
      reply:
        "I hear your exhaustion, and your frustration is completely valid. When you are carrying so much distress, clinical exercises can feel like just another demanding task on an impossible list.\n\n" +
        "Let's strip away all the techniques and advice. You don't have to fix anything or think positively right now. " +
        "If you could give yourself permission to do nothing and simply rest for the rest of today, what would that look like?",
    }
  }

  // 3. Affirmation / Receptivity / "Yes" in multi-turn context
  const isAffirmative = [
    "yes",
    "yeah",
    "yep",
    "sure",
    "okay",
    "ok",
    "agree",
    "that makes sense",
    "i agree",
    "will try",
    "i will",
    "sounds good",
    "right",
  ].some((w) => lower === w || lower.startsWith(w + " ") || lower.endsWith(" " + w))

  if (isAffirmative && turnCount > 1) {
    if (
      historyText.includes("work") ||
      historyText.includes("job") ||
      historyText.includes("boss") ||
      historyText.includes("exam")
    ) {
      return {
        toolSuggestion: "Cognitive Anchor",
        reply:
          "That insight is where real neuroplastic change begins. You are shifting from automatic perfectionism to balanced capability.\n\n" +
          "Let's anchor this thought: 'My worth is not defined by external productivity or anyone else's temporary mood. I am doing what I can, and that is enough.'\n\n" +
          "How does that perspective feel when you read it slowly to yourself?",
      }
    }
    if (
      historyText.includes("relationship") ||
      historyText.includes("partner") ||
      historyText.includes("friend") ||
      historyText.includes("breakup")
    ) {
      return {
        toolSuggestion: "Boundary Setting",
        reply:
          "Recognizing that boundary is a major therapeutic step. Stepping out of mind-reading and personalizing allows you to preserve your own peace.\n\n" +
          "What is one healthy boundary or self-care choice you want to honor for yourself as you move forward today?",
      }
    }
    if (
      historyText.includes("sleep") ||
      historyText.includes("insomnia") ||
      historyText.includes("bed")
    ) {
      return {
        toolSuggestion: "CBT-I Anchor",
        reply:
          "Wonderful. Tonight, let's treat sleep not as a battle, but as gentle recovery. Keep the room dim, put notifications on silence, and write any stray thoughts on a bedside notepad.\n\n" +
          "What time tonight feels like a realistic, calm target to begin your wind-down routine?",
      }
    }
    return {
      toolSuggestion: "Cognitive Restructuring",
      reply:
        "That breakthrough is meaningful. In CBT, the goal isn't just identifying the distortion, but deliberately practicing the balanced thought.\n\n" +
        "If you were to summarize this new, compassionate perspective in one sentence to carry with you today, what would it say?",
    }
  }

  // 4. Uncertainty / Hesitation / "I don't know"
  if (
    lower.includes("i don't know") ||
    lower.includes("dont know") ||
    lower.includes("not sure") ||
    lower.includes("hard to say") ||
    lower.includes("maybe")
  ) {
    return {
      toolSuggestion: "Compassionate Pacing",
      reply:
        "It is completely okay not to know. In therapy, uncertainty is often where the mind is trying to protect itself from being overwhelmed.\n\n" +
        "You don't need to have the entire situation figured out today. If we strip away all the 'what-ifs' and look only at the next couple of hours, what is the single smallest kindness you can offer yourself?",
    }
  }

  // 5. Greetings / Check-in start
  if (
    (lower === "hi" ||
      lower === "hello" ||
      lower === "hey" ||
      lower.startsWith("hi ") ||
      lower.startsWith("hello ") ||
      lower.startsWith("hey ")) &&
    turnCount <= 1
  ) {
    return {
      toolSuggestion: "Mindful Check-in",
      reply:
        "Welcome to your safe reflection space. I'm glad you took this time for yourself today.\n\n" +
        "Before we unpack any thoughts, take a slow breath and notice: where is your body holding tension right now (jaw, shoulders, chest, stomach)? " +
        "What is the most prominent feeling or situation that brought you here today?",
    }
  }

  // 6. Acute Panic / Severe Physical Anxiety
  if (
    lower.includes("panic") ||
    lower.includes("can't breathe") ||
    lower.includes("cant breathe") ||
    lower.includes("racing heart") ||
    lower.includes("heart is racing") ||
    lower.includes("shaking") ||
    lower.includes("chest tight") ||
    lower.includes("hyperventilat")
  ) {
    return {
      toolSuggestion: "Somatic Reset (5-4-3-2-1)",
      reply:
        "Let's step out of the racing thoughts and bring your nervous system back to safety immediately:\n\n" +
        "1. Feel your feet flat on the floor right now. You are physically safe in this space.\n" +
        "2. Inhale gently for 4 counts... hold softly for 2... exhale with a long sigh for 6 counts.\n" +
        "3. Name 3 physical objects you can see with your eyes right now.\n\n" +
        "Your racing heart is simply adrenaline doing its job; it cannot hurt you and it will pass. What are two textures you can touch near you?",
    }
  }

  // 7. Cognitive Distortions
  // Catastrophizing
  if (
    lower.includes("worst") ||
    lower.includes("disaster") ||
    lower.includes("horrible") ||
    lower.includes("doomed") ||
    lower.includes("end of the world") ||
    lower.includes("catastrophe") ||
    lower.includes("ruined forever")
  ) {
    return {
      distortionHint: "catastrophizing",
      toolSuggestion: "Decatastrophizing",
      reply:
        "Notice how quickly your mind jumped directly to the absolute worst-case scenario. In CBT, this is Catastrophizing. It is your brain's protective instinct going into hyper-drive, treating an anxious thought as an inevitable reality.\n\n" +
        "Let's reality-test this thought together:\n" +
        "• What is the absolute worst outcome you fear?\n" +
        "• What is the most realistic, probable outcome?\n" +
        "• If the difficult scenario happened, how could you cope with it step-by-step?",
    }
  }

  // All-or-Nothing
  if (
    lower.includes("always") ||
    lower.includes("never") ||
    lower.includes("completely failed") ||
    lower.includes("total failure") ||
    lower.includes("ruined everything") ||
    lower.includes("worthless") ||
    lower.includes("everything is wrong")
  ) {
    return {
      distortionHint: "allOrNothing",
      toolSuggestion: "Dialectical Reframing",
      reply:
        "I notice absolute words like 'always', 'never', or 'total failure'. In CBT, this is All-or-Nothing (Black-and-White) thinking. When we are distressed, our cognitive filter deletes all shades of gray and partial progress.\n\n" +
        "Let's test this belief against the facts: Can you point to even one small thing that hasn't gone completely wrong, or a past instance where you navigated a similar hurdle?",
    }
  }

  // Mind Reading
  if (
    lower.includes("they hate me") ||
    lower.includes("they think i'm") ||
    lower.includes("everyone thinks") ||
    lower.includes("judging me") ||
    lower.includes("laughing at me") ||
    lower.includes("they are disappointed")
  ) {
    return {
      distortionHint: "mindReading",
      toolSuggestion: "Evidence Testing",
      reply:
        "You might be experiencing Mind Reading — assuming you know what others are privately thinking about you. We frequently project our own inner self-criticism onto other people's silence or neutral facial expressions.\n\n" +
        "Do you have concrete, spoken proof that they feel this way, or is your anxious mind filling in the blanks with worst-case assumptions?",
    }
  }

  // Should Statements
  if (
    lower.includes("i should") ||
    lower.includes("i shouldn't") ||
    lower.includes("i must") ||
    lower.includes("i ought to") ||
    lower.includes("have to be perfect")
  ) {
    return {
      distortionHint: "shouldStatements",
      toolSuggestion: "Cognitive Defusion",
      reply:
        "Notice the words 'should' or 'must'. In cognitive therapy, 'Should Statements' act like an internal tyrant, setting impossible demands that inevitably produce guilt and shame.\n\n" +
        "What happens if you replace 'I should' with 'I would prefer to, but I am human and allowed to learn'? Notice how that simple word shift changes the constriction in your chest.",
    }
  }

  // 8. Topic-Specific In-Depth Therapy
  // Career / Work / Imposter Syndrome
  if (
    lower.includes("work") ||
    lower.includes("job") ||
    lower.includes("boss") ||
    lower.includes("manager") ||
    lower.includes("deadline") ||
    lower.includes("imposter") ||
    lower.includes("fraud") ||
    lower.includes("presentation") ||
    historyText.includes("boss") ||
    historyText.includes("deadline")
  ) {
    const snippet = currentText.length > 50 ? currentText.slice(0, 47) + "..." : currentText
    return {
      toolSuggestion: "Professional Boundary Restructuring",
      reply:
        `When navigating workplace pressure around "${snippet}", our minds often fuse our personal self-worth with our external performance. ` +
        `Feeling like an imposter or fearing failure usually doesn't mean you lack competence — it usually means your standards are extraordinarily high.\n\n` +
        `If you evaluate this objectively, what is one piece of tangible evidence of your competence that your anxiety is ignoring right now?`,
    }
  }

  // Academics / Study / Exams
  if (
    lower.includes("exam") ||
    lower.includes("study") ||
    lower.includes("test") ||
    lower.includes("college") ||
    lower.includes("grades") ||
    lower.includes("gpa")
  ) {
    return {
      toolSuggestion: "Academic Desensitization",
      reply:
        "Academic stress triggers a fear of social disqualification and future uncertainty. Your brain is treating an upcoming test or grade as a measure of your entire life's trajectory.\n\n" +
        "Remember: an exam tests your recall on a specific day in a specific format — it does not measure your intelligence, adaptability, or character. " +
        "What is the single most important topic you can study for 20 minutes right now before taking a mindful break?",
    }
  }

  // Relationships / Conflict / Heartbreak
  if (
    lower.includes("relationship") ||
    lower.includes("partner") ||
    lower.includes("boyfriend") ||
    lower.includes("girlfriend") ||
    lower.includes("breakup") ||
    lower.includes("fight") ||
    lower.includes("argued") ||
    lower.includes("lonely") ||
    lower.includes("alone") ||
    lower.includes("friend") ||
    lower.includes("family")
  ) {
    return {
      toolSuggestion: "Relational Decentering",
      reply:
        "Interpersonal friction triggers our evolutionary fear of abandonment. When someone close to us is distant or critical, our immediate impulse is to ask: 'What did I do wrong?'\n\n" +
        "Try to decenter: their behavior is filtered through their own stress, past wounds, and communication limits. It is not an objective assessment of your value. " +
        "What boundary or emotional need do you need to honor for yourself in this situation?",
    }
  }

  // Sleep & Insomnia
  if (
    lower.includes("sleep") ||
    lower.includes("insomnia") ||
    lower.includes("cant sleep") ||
    lower.includes("can't sleep") ||
    lower.includes("night") ||
    lower.includes("bed")
  ) {
    return {
      toolSuggestion: "CBT-I Stimulus Control",
      reply:
        "In Cognitive Behavioral Therapy for Insomnia (CBT-I), the bed should only be associated with rest, not problem-solving. When you lie awake spiraling, your brain associates the mattress with alertness.\n\n" +
        "If you have been awake for more than 20 minutes, get out of bed, sit in a dimly lit chair, and write down your worries on paper so your mind knows they won't be lost. Then only return to bed when your eyelids feel heavy.",
    }
  }

  // Sadness / Grief / Emptiness
  if (
    lower.includes("sad") ||
    lower.includes("depress") ||
    lower.includes("empty") ||
    lower.includes("numb") ||
    lower.includes("crying") ||
    lower.includes("lost") ||
    lower.includes("grief") ||
    lower.includes("hurting")
  ) {
    return {
      toolSuggestion: "Compassionate Inquiry",
      reply:
        "I want to validate how heavy and exhausting sadness feels. You do not have to force yourself to 'snap out of it' or be productive right now. " +
        "Sadness is often the nervous system's way of asking for quiet, protective space.\n\n" +
        "If you were to treat yourself with the unconditional tenderness you would offer a dear friend going through this, what would you do for yourself today?",
    }
  }

  // 9. Adaptive Dynamic Clinician Reflection (Synthesizes specific user text, emotional nuance, and previous context)
  const cleanSnippet = currentText.replace(/[.!?]+$/, "").trim()
  const displaySnippet = cleanSnippet.length > 60 ? cleanSnippet.slice(0, 57) + "..." : cleanSnippet

  if (turnCount >= 2) {
    return {
      toolSuggestion: "Socratic Deconstruction",
      reply:
        `When you share "${displaySnippet}", notice how that thought connects to what we've been unpacking. ` +
        `Beneath that statement, there is a vulnerable human part of you asking for safety, respect, or relief.\n\n` +
        `If we strip away the fear of judgment, what is the core need that feels unmet right now? What would bring you a sense of grounded stability?`,
    }
  }

  return {
    toolSuggestion: "Emotional Exploration",
    reply:
      `I hear you reflecting on "${displaySnippet}". In our therapeutic space, every automatic thought carries an emotional core. ` +
      `When this thought comes up for you, what core emotion is beneath it — fear of failure, sadness, feeling unseen, or needing control? ` +
      `How does that emotion feel in your body right now?`,
  }
}

export default function DigitalTherapistPage() {
  const [messages, setMessages] = useState<TherapistMessage[]>([
    {
      id: "intro",
      role: "therapist",
      text: "Welcome to your Digital Therapy space. I practice Cognitive Behavioral Therapy (CBT) and somatic regulation. This is a non-judgmental environment to unpack difficult emotions, deconstruct cognitive distortions, and regulate your nervous system. What situation or thought is feeling heaviest right now?",
    },
  ])
  const [input, setInput] = useState("")
  const [typing, setTyping] = useState(false)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, typing])

  const handleSend = (textOverride?: string) => {
    const text = (textOverride || input).trim()
    if (!text) return

    const userMsg: TherapistMessage = {
      id: "usr-" + Date.now(),
      role: "user",
      text,
    }

    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setTyping(true)

    setTimeout(() => {
      const response = generateTherapistResponse(text, [...messages, userMsg])

      setMessages((prev) => [
        ...prev,
        {
          id: "th-" + Date.now(),
          role: "therapist",
          text: response.reply,
          distortionHint: response.distortionHint,
          toolSuggestion: response.toolSuggestion,
        },
      ])
      setTyping(false)
    }, 900)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-4"
    >
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <HeartHandshake className="w-6 h-6 text-soul-teal" />
          Digital Therapist (CBT Clinical Mode)
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Evidence-based Cognitive Behavioral Therapy, distortion reframing, and immediate human escalation.
        </p>
      </div>

      {/* Escalation & Doctor Connection Banner */}
      <Card variant="interactive" className="p-4 bg-gradient-to-r from-soul-purple/10 to-soul-teal/10 border-soul-purple/30">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-soul-purple/20 flex items-center justify-center text-soul-purple shrink-0">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                Need Human Medical or Clinical Care?
                <Badge variant="purple" size="sm">Licensed Doctors</Badge>
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                The digital therapist does not replace psychiatric care. You can consult with verified doctors anytime.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <Link href="/dashboard/appointments" className="flex-1 md:flex-none">
              <Button
                size="sm"
                variant="primary"
                className="w-full bg-soul-purple hover:bg-soul-purple/90 text-white font-bold"
                icon={<CalendarCheck className="w-4 h-4" />}
              >
                Book a Real Doctor
              </Button>
            </Link>
            <a
              href="tel:14416"
              className="px-3 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-bold flex items-center gap-1 transition-all shrink-0"
              title="Emergency Mental Health Helpline"
            >
              <Phone className="w-3.5 h-3.5" /> Emergency SOS (14416)
            </a>
          </div>
        </div>
      </Card>

      {/* Chat Container */}
      <Card padding="none" className="h-[620px] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3 border-b border-border flex items-center justify-between bg-card/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-soul-teal to-emerald-500 flex items-center justify-center text-white">
              <HeartHandshake className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">CBT Clinical Assistant</p>
              <p className="text-[10px] text-muted-foreground">Cognitive Restructuring & Somatic Regulation</p>
            </div>
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              setMessages([
                {
                  id: "intro",
                  role: "therapist",
                  text: "Resetting session. I'm listening. What would you like to explore or reframe right now?",
                },
              ])
            }
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Reset
          </Button>
        </div>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center ${
                  m.role === "user"
                    ? "bg-soul-purple/20 text-soul-purple"
                    : "bg-soul-teal/20 text-soul-teal"
                }`}
              >
                {m.role === "user" ? <User className="w-4 h-4" /> : <HeartHandshake className="w-4 h-4" />}
              </div>

              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-soul-purple text-white rounded-br-md"
                    : "bg-secondary text-foreground rounded-bl-md border border-border/60"
                }`}
              >
                <p className="whitespace-pre-wrap">{m.text}</p>

                {m.distortionHint && CBT_DISTORTIONS[m.distortionHint] && (
                  <div className="mt-3 pt-2.5 border-t border-border/80 text-xs">
                    <span className="font-bold text-amber-400 block mb-0.5">
                      💡 Cognitive Distortion Identified: {CBT_DISTORTIONS[m.distortionHint].name}
                    </span>
                    <span className="text-muted-foreground">
                      {CBT_DISTORTIONS[m.distortionHint].advice}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          ))}

          {typing && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-lg bg-soul-teal/20 text-soul-teal flex items-center justify-center">
                <HeartHandshake className="w-4 h-4" />
              </div>
              <div className="bg-secondary px-4 py-3 rounded-2xl rounded-bl-md flex gap-1.5 items-center">
                <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce delay-150" />
                <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce delay-300" />
              </div>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Quick Therapy Starters */}
        <div className="px-4 py-2 border-t border-border/50 bg-secondary/20 flex flex-wrap gap-2">
          {[
            "I'm catastrophizing about an outcome",
            "I feel like a complete failure",
            "I feel panic in my chest right now",
            "I'm worried everyone is judging me",
          ].map((prompt) => (
            <button
              key={prompt}
              onClick={() => handleSend(prompt)}
              className="text-xs px-2.5 py-1 rounded-full bg-secondary border border-border text-muted-foreground hover:text-foreground hover:border-soul-teal transition-all"
            >
              💭 {prompt}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-border bg-card">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe what's weighing on you or what thought you want to reframe..."
              rows={1}
              className="flex-1 px-4 py-2.5 rounded-xl bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-soul-teal/50 resize-none text-sm"
            />
            <Button
              onClick={() => handleSend()}
              disabled={!input.trim() || typing}
              className="bg-soul-teal hover:bg-soul-teal/90 text-white font-bold"
              icon={<Send className="w-4 h-4" />}
            >
              Reflect
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}
