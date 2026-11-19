"use client"

/**
 * Firebase Authentication & Cloud Firestore Client Integration.
 *
 * Pre-configured for SoulSync's Google Cloud / Firebase project:
 *   - projectId: "soulsync-511804"
 *   - authDomain: "soulsync-511804.firebaseapp.com"
 *   - messagingSenderId: "231866221016"
 *
 * Dynamically loads Google's official Firebase SDK from gstatic CDN so builds
 * stay fast and zero-conflict on Vercel.
 */

declare global {
  interface Window {
    firebase?: any
  }
}

export const FIREBASE_CONFIG = {
  apiKey: (process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "").trim().replace(/^["']|["']$/g, ""),
  authDomain:
    (process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "").trim() ||
    "soulsync-511804.firebaseapp.com",
  projectId:
    (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "").trim() ||
    "soulsync-511804",
  storageBucket:
    (process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "").trim() ||
    "soulsync-511804.firebasestorage.app",
  messagingSenderId:
    (process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "").trim() ||
    "231866221016",
  appId: (process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "").trim(),
}

export function isFirebaseConfigured(): boolean {
  return Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.apiKey.startsWith("AIza"))
}

let _sdkLoadPromise: Promise<any> | null = null

function loadScript(id: string, src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(id) as HTMLScriptElement | null
    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve()
        return
      }
      existing.addEventListener("load", () => resolve())
      existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)))
      return
    }
    const s = document.createElement("script")
    s.id = id
    s.src = src
    s.async = true
    s.onload = () => {
      s.dataset.loaded = "true"
      resolve()
    }
    s.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(s)
  })
}

export async function getFirebaseApp(): Promise<any | null> {
  if (typeof window === "undefined" || !isFirebaseConfigured()) {
    return null
  }
  if (_sdkLoadPromise) {
    return _sdkLoadPromise
  }

  _sdkLoadPromise = (async () => {
    await loadScript(
      "fb-app-sdk",
      "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js"
    )
    await Promise.all([
      loadScript(
        "fb-auth-sdk",
        "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js"
      ),
      loadScript(
        "fb-firestore-sdk",
        "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js"
      ),
    ])

    const fb = window.firebase
    if (!fb) return null
    if (!fb.apps || fb.apps.length === 0) {
      fb.initializeApp(FIREBASE_CONFIG)
    }
    return fb
  })()

  return _sdkLoadPromise
}

export async function signInWithFirebaseGoogle(): Promise<{
  idToken: string
  email: string
  name: string
  uid: string
}> {
  const fb = await getFirebaseApp()
  if (!fb) {
    throw new Error("Firebase API Key is not configured yet.")
  }

  const provider = new fb.auth.GoogleAuthProvider()
  provider.setCustomParameters({ prompt: "select_account" })

  const result = await fb.auth().signInWithPopup(provider)
  const user = result.user
  const idToken = await user.getIdToken()

  // Persist user profile to Cloud Firestore
  try {
    const db = fb.firestore()
    await db
      .collection("soulsync_users")
      .doc(user.uid)
      .set(
        {
          uid: user.uid,
          email: (user.email || "").toLowerCase(),
          name: user.displayName || (user.email || "").split("@")[0],
          photoURL: user.photoURL || null,
          lastLoginAt: new Date().toISOString(),
        },
        { merge: true }
      )
  } catch (err) {
    console.warn("Firestore user profile sync skipped:", err)
  }

  return {
    idToken,
    email: user.email || "",
    name: user.displayName || "",
    uid: user.uid || "",
  }
}

export async function syncDocumentToFirestore(
  collectionName: string,
  docId: string,
  data: Record<string, any>
): Promise<void> {
  if (typeof window === "undefined" || !isFirebaseConfigured()) return
  try {
    const fb = await getFirebaseApp()
    if (!fb) return
    await fb
      .firestore()
      .collection(collectionName)
      .doc(docId)
      .set(
        {
          ...data,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      )
  } catch (err) {
    console.debug(`Firestore sync (${collectionName}/${docId}) skipped:`, err)
  }
}
