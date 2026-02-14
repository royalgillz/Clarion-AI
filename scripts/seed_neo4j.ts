/**
 * scripts/seed_neo4j.ts
 * Pure Neo4j seeding — zero Gemini calls. Completes in ~5 seconds.
 */
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// Only import Neo4j helpers — no gemini import at all
import { createSchema, upsertTestNode, closeDriver } from "../src/lib/neo4j";

const CBC_TESTS = [
  { id:"RBC",       name:"Red Blood Cell Count",                      aliases:["RBC","Erythrocyte Count","Red Cell Count"],              unit:"million cells/mcL", nhanes_variable:"LBXRBCSI", label:"Number of red blood cells per microliter",              panel:"CBC" },
  { id:"HGB",       name:"Hemoglobin",                                aliases:["Hgb","HGB","Haemoglobin"],                              unit:"g/dL",              nhanes_variable:"LBXHGB",   label:"Oxygen-carrying protein in red blood cells",           panel:"CBC" },
  { id:"HCT",       name:"Hematocrit",                                aliases:["Hct","HCT","Packed Cell Volume","PCV"],                 unit:"%",                 nhanes_variable:"LBXHCT",   label:"Percentage of blood that is red blood cells",          panel:"CBC" },
  { id:"MCV",       name:"Mean Corpuscular Volume",                   aliases:["MCV","Mean Cell Volume"],                               unit:"fL",                nhanes_variable:"LBXMCVSI", label:"Average size of a red blood cell",                     panel:"CBC" },
  { id:"MCH",       name:"Mean Corpuscular Hemoglobin",               aliases:["MCH","Mean Cell Hemoglobin"],                           unit:"pg",                nhanes_variable:"LBXMC",    label:"Average hemoglobin amount per red blood cell",         panel:"CBC" },
  { id:"MCHC",      name:"Mean Corpuscular Hemoglobin Concentration", aliases:["MCHC"],                                                 unit:"g/dL",              nhanes_variable:"LBXMCHSI", label:"Average hemoglobin concentration in red blood cells",  panel:"CBC" },
  { id:"RDW",       name:"Red Cell Distribution Width",               aliases:["RDW","RDW-CV"],                                         unit:"%",                 nhanes_variable:"LBXRDW",   label:"Variation in red blood cell size",                     panel:"CBC" },
  { id:"WBC",       name:"White Blood Cell Count",                    aliases:["WBC","Leukocyte Count","White Cell Count","WCC"],        unit:"10^3/mcL",          nhanes_variable:"LBXWBCSI", label:"Total immune cells; reflects infection and immune status", panel:"CBC" },
  { id:"PLT",       name:"Platelet Count",                            aliases:["PLT","Thrombocyte Count","Platelets","PLAT"],            unit:"10^3/mcL",          nhanes_variable:"LBXPLTSI", label:"Clotting cell fragments; low means bleeding risk",     panel:"CBC" },
  { id:"MPV",       name:"Mean Platelet Volume",                      aliases:["MPV"],                                                  unit:"fL",                nhanes_variable:"LBXMPSI",  label:"Average platelet size",                                panel:"CBC" },
  { id:"NEUT",      name:"Neutrophils",                               aliases:["Neutrophil Count","NEUT","Segs","PMN","Polys"],          unit:"%",                 nhanes_variable:"LBDNENO",  label:"White cells that fight bacterial infections",          panel:"CBC Differential" },
  { id:"LYMPH",     name:"Lymphocytes",                               aliases:["Lymphocyte Count","Lymphs","LYMPH"],                    unit:"%",                 nhanes_variable:"LBDLYMNO", label:"White cells key to viral immunity",                    panel:"CBC Differential" },
  { id:"MONO",      name:"Monocytes",                                 aliases:["Monocyte Count","Monos","MONO"],                        unit:"%",                 nhanes_variable:"LBDMONO",  label:"White cells for chronic infection and inflammation",   panel:"CBC Differential" },
  { id:"EOS",       name:"Eosinophils",                               aliases:["Eosinophil Count","Eos","EOS"],                         unit:"%",                 nhanes_variable:"LBDEO",    label:"White cells elevated in allergies and parasites",      panel:"CBC Differential" },
  { id:"BASO",      name:"Basophils",                                 aliases:["Basophil Count","Basos","BASO"],                        unit:"%",                 nhanes_variable:"LBDBANO",  label:"Rare white cells in allergic and inflammatory responses", panel:"CBC Differential" },
  { id:"NEUT_ABS",  name:"Absolute Neutrophil Count",                 aliases:["ANC","NEUT#"],                                          unit:"10^3/mcL",          nhanes_variable:"LBXNE",    label:"Absolute neutrophil count used for infection risk",    panel:"CBC Differential" },
  { id:"LYMPH_ABS", name:"Absolute Lymphocyte Count",                 aliases:["ALC","LYMPH#"],                                         unit:"10^3/mcL",          nhanes_variable:"LBXLYM",   label:"Absolute lymphocyte count monitors immune function",   panel:"CBC Differential" },
  { id:"RETIC",     name:"Reticulocyte Count",                        aliases:["Retics","RETIC","Reticulocyte Percent"],                 unit:"%",                 nhanes_variable:"LBXRET",   label:"Immature red cells reflecting bone marrow activity",   panel:"CBC Extended" },
  { id:"RETIC_ABS", name:"Absolute Reticulocyte Count",               aliases:["Absolute Retics","RETIC#"],                             unit:"10^3/mcL",          nhanes_variable:"LBXRETNI", label:"Absolute count of immature red blood cells",           panel:"CBC Extended" },
  { id:"NRBC",      name:"Nucleated Red Blood Cells",                 aliases:["NRBC","Nucleated RBC"],                                 unit:"/100 WBC",          nhanes_variable:"LBXNRBC",  label:"Immature RBCs with nucleus; abnormal in adults",       panel:"CBC Differential" },
];

async function main() {
  console.log("🔗 Connecting to Neo4j…");
  ["NEO4J_URI", "NEO4J_USERNAME", "NEO4J_PASSWORD"].forEach((v) => {
    if (!process.env[v]) throw new Error(`Missing env var: ${v}`);
  });
  console.log(`   NEO4J_URI = ${process.env.NEO4J_URI}\n`);

  console.log("📐 Creating schema…");
  await createSchema();

  console.log(`\n🧬 Seeding ${CBC_TESTS.length} CBC tests…\n`);
  for (let i = 0; i < CBC_TESTS.length; i++) {
    const t = CBC_TESTS[i];
    process.stdout.write(`  [${i + 1}/${CBC_TESTS.length}] ${t.id.padEnd(12)} `);
    await upsertTestNode(t);
    console.log("✅");
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Seeding complete!
   Tests : ${CBC_TESTS.length}
   Panels: CBC, CBC Differential, CBC Extended

Run next:  npm run dev  →  http://localhost:3000
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);
  await closeDriver();
}

main().catch((err) => {
  console.error("\n❌ Seed failed:", err);
  process.exit(1);
});