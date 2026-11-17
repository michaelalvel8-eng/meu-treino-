const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
initializeApp();
const adminDb = getFirestore();

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

exports.generateWorkout = onCall(
  {
    region: "southamerica-east1",
    secrets: [OPENAI_API_KEY],
    timeoutSeconds: 120,
    memory: "256MiB",
    enforceAppCheck: false
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Entre com Google para gerar e salvar treinos.");
    }

    const input = request.data || {};
    const age = Number(input.age);
    const height = Number(input.height);
    const weight = Number(input.weight);
    const days = Math.min(6, Math.max(2, Number(input.days) || 3));
    const duration = Math.min(180, Math.max(20, Number(input.duration) || 60));

    if (!Number.isFinite(age) || age < 14 || age > 100 ||
        !Number.isFinite(height) || height < 100 || height > 230 ||
        !Number.isFinite(weight) || weight < 30 || weight > 300) {
      throw new HttpsError("invalid-argument", "Confira idade, altura e peso.");
    }

    const usageRef = adminDb.collection("_privateAiUsage").doc(request.auth.uid);
    const usageDay = new Date().toISOString().slice(0, 10);
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(usageRef);
      const current = snap.exists && snap.data().day === usageDay ? Number(snap.data().count || 0) : 0;
      if (current >= 10) {
        throw new HttpsError("resource-exhausted", "Limite diário de 10 gerações atingido. Tente novamente amanhã.");
      }
      tx.set(usageRef, { day: usageDay, count: current + 1, updatedAt: new Date() }, { merge: true });
    });

    const recentLogs = Array.isArray(input.recentLogs) ? input.recentLogs.slice(-40) : [];
    const profile = {
      age, heightCm: height, weightKg: weight,
      goal: String(input.goal || "Hipertrofia / ganho de massa").slice(0, 120),
      scope: input.scope === "week" ? "week" : "today",
      days,
      level: String(input.level || "Intermediário").slice(0, 40),
      durationMinutes: duration,
      equipment: String(input.equipment || "Academia completa").slice(0, 200),
      focus: String(input.focus || "Equilibrado").slice(0, 200),
      recentLogs
    };

    const system = [
      "Você é um assistente de planejamento de treinamento físico, cauteloso e baseado em princípios gerais de treinamento.",
      "Responda SOMENTE com JSON válido, sem markdown.",
      "Não faça diagnóstico médico. Não recomende treinar com dor, lesão ou sintomas. Inclua orientação para ajustar a carga pela técnica e esforço.",
      "Considere os registros recentes e evite concentrar grupos musculares sem recuperação adequada.",
      "Não invente que o usuário executou exercícios que não aparecem nos registros.",
      "Para scope=today, retorne {title, objective, exercises:[{name,sets,reps,rest,notes}], guidance}.",
      "Para scope=week, retorne {title, objective, days:[{day,title,exercises:[{name,sets,reps,rest,notes}]}], guidance}.",
      "Use linguagem simples em português brasileiro. Respeite o tempo de sessão e equipamentos disponíveis."
    ].join(" ");

    const prompt = "Monte o treino usando este perfil JSON: " + JSON.stringify(profile);

    let response;
    try {
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY.value()}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          temperature: 0.4,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt }
          ]
        })
      });
    } catch (error) {
      throw new HttpsError("unavailable", "Não foi possível conectar ao serviço de IA.");
    }

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      console.error("AI provider returned status", response.status, details.slice(0, 500));
      throw new HttpsError("internal", "O serviço de IA não conseguiu gerar o treino. Verifique a chave e o saldo da API.");
    }

    const body = await response.json();
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new HttpsError("internal", "A IA retornou uma resposta vazia.");

    let plan;
    try {
      plan = JSON.parse(content);
    } catch {
      throw new HttpsError("internal", "A resposta da IA não veio em formato JSON válido.");
    }

    if (profile.scope === "week" && !Array.isArray(plan.days)) {
      throw new HttpsError("internal", "A IA não retornou a divisão semanal esperada.");
    }
    if (profile.scope === "today" && !Array.isArray(plan.exercises)) {
      throw new HttpsError("internal", "A IA não retornou os exercícios esperados.");
    }

    return { plan };
  }
);
