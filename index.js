
```javascript
import Anthropic from "@anthropic-ai/sdk";
import readline from "readline";

const client = new Anthropic();

// In-memory storage for reminders
const reminders = [];
let conversationHistory = [];

// Helper function to format reminders for display
function formatReminders() {
  if (reminders.length === 0) {
    return "No hay recordatorios registrados.";
  }

  return reminders
    .map(
      (r, index) =>
        `${index + 1}. ${r.medication} - ${r.dosage} - ${r.time} (${r.frequency})`
    )
    .join("\n");
}

// Helper function to check for overdue reminders
function checkOverdueReminders() {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`;

  const overdueReminders = reminders.filter((r) => {
    const [reminderHour, reminderMinute] = r.time.split(":").map(Number);
    const reminderTotalMinutes = reminderHour * 60 + reminderMinute;
    const currentTotalMinutes = currentHour * 60 + currentMinute;

    // Check if it's past the reminder time
    return (
      currentTotalMinutes >= reminderTotalMinutes &&
      currentTotalMinutes < reminderTotalMinutes + 60
    );
  });

  return overdueReminders;
}

// Process user request with Claude
async function processRequest(userMessage) {
  conversationHistory.push({
    role: "user",
    content: userMessage,
  });

  // Include current reminders in the context
  const remindersContext = `
Current reminders in the system:
${formatReminders()}

Current date and time: ${new Date().toLocaleString()}

Overdue reminders (last hour):
${checkOverdueReminders().length > 0 ? checkOverdueReminders().map((r) => `- ${r.medication} (${r.time})`).join("\n") : "None"}
`;

  const systemPrompt = `You are a helpful medication reminder assistant. You help users:
1. Add new medication reminders (format: "Add [medication] [dosage] at [HH:MM] [frequency]")
2. View their current reminders
3. Remove reminders (by number/name)
4. Get alerts about overdue medications
5. Provide medication information

${remindersContext}

When a user wants to add a reminder, extract:
- Medication name
- Dosage
- Time (HH:MM format, 24-hour)
- Frequency (daily, twice daily, every 8 hours, etc.)

Respond conversationally and helpfully. If the user asks to add a reminder, confirm the details.`;

  const response = await client.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 1024,
    system: systemPrompt,
    messages: conversationHistory,
  });

  const assistantMessage =
    response.content[0].type === "text" ? response.content[0].text : "";

  conversationHistory.push({
    role: "assistant",
    content: assistantMessage,
  });

  // Process commands based on user input
  const lowerInput = userMessage.toLowerCase();

  if (
    lowerInput.includes("agregar") ||
    lowerInput.includes("add") ||
    lowerInput.includes("nuevo")
  ) {
    // Extract reminder details from user message
    const medicationMatch = userMessage.match(
      /(?:agregar|add|nuevo)\s+([a-záéíóúñ\w]+)/i
    );
    const dosageMatch = userMessage.match(/(\d+\s*(?:mg|ml|gr|comprimidos|gotas))/i);
    const timeMatch = userMessage.match(/(\d{1,2}):(\d{2})/);
    const frequencyMatch = userMessage.match(
      /(diario|diariamente|dos veces|cada\s*\d+\s*horas|cada\s*día)/i
    );

    if (medicationMatch && timeMatch) {
      const medication = medicationMatch[1];
      const dosage = dosageMatch ? dosageMatch[1] : "1 comprimido";
      const time = `${String(timeMatch[1]).padStart(2, "0")}:${timeMatch[2]}`;
      const frequency = frequencyMatch ? frequencyMatch[1] : "diario";

      reminders.push({
        medication,
        dosage,
        time,
        frequency,
        addedAt: new Date(),
      });

      return `✅ Recordatorio agregado:\n${medication} - ${dosage} a las ${time} (${frequency})\n\n${assistantMessage}`;
    }
  }

  if (lowerInput.includes("eliminar") || lowerInput.includes("remove")) {
    const indexMatch = userMessage.match(/(\d+)/);
    if (indexMatch) {
      const index = parseInt(indexMatch[1]) - 1;
      if (index >= 0 && index < reminders.length) {
        const removed = reminders.splice(index, 1)[0];
        return `✅ Recordatorio eliminado: ${removed.medication}\n\n${assistantMessage}`;
      }
    }
  }

  if (
    lowerInput.includes("lista") ||
    lowerInput.includes("listar") ||
    lowerInput.includes("ver")
  ) {
    return `📋 Tus recordatorios:\n${formatReminders()}\n\n${assistantMessage}`;
  }

  if (
    lowerInput.includes("alerta") ||
    lowerInput.includes("vencido") ||