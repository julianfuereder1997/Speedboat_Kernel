import type { BlockContext } from "@speedboat/core";
import type { ModelPrompt } from "@speedboat/adapters";
import type { PackBundle } from "./pack-loader.js";

/**
 * Baut den Prompt eines Bausteins: system = Skill-Text (bei Kritikern plus Bias-Profil),
 * user = genau der Kontext aus build_context plus Ausgabehinweise. Kein Verlauf, nichts sonst.
 */
export function build_prompt(bundle: PackBundle, block: string, ctx: BlockContext): ModelPrompt {
  const contract = bundle.pack.blocks.find((b) => b.block === block);
  if (!contract) throw new Error(`Baustein ${block} ist im Pack nicht definiert`);
  const skill = bundle.skills[block];
  if (skill === undefined) throw new Error(`Baustein ${block} hat keinen Skill-Text`);

  let system = skill.trim();
  if (contract.bias !== undefined) {
    system += `\n\n## Perspektive\n\n\`\`\`json\n${JSON.stringify(bundle.pack.bias_profiles[contract.bias], null, 2)}\n\`\`\``;
  }

  const parts = [
    "## Eingaben",
    "Das ist der vollständige Ausschnitt der Fallakte, der dir zur Verfügung steht. Andere Informationen gibt es nicht.",
    'Ein Feld "_provenance" an einem Objekt nennt seine Herkunft.',
    "```json\n" + JSON.stringify(ctx.data, null, 2) + "\n```",
  ];
  if (contract.type === "critic") {
    const markers = bundle.pack.markers.filter((m) => contract.markers?.includes(m.id));
    parts.push(
      "## Marker",
      "Verwende ausschließlich diese Marker:",
      markers.map((m) => `- ${m.id}${m.description ? `: ${m.description}` : ""}`).join("\n"),
      'Jeder Befund nennt in "target" den Pfad des betroffenen Objekts, zum Beispiel /objects/<typ>/<id>.',
    );
  }
  parts.push("## Ausgabe", "Antworte ausschließlich mit einem JSON-Objekt, das dem vorgegebenen Schema entspricht.");
  return { system, user: parts.join("\n\n") };
}
