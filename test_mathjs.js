const mathjs = require('mathjs');

const formula = "((g / 1000) * precoKg + (potenciaw / 1000) * horas * valorKwh + desgaste + (horas * maoHora)) * (1 + margem)";

const scope = {
    g: 5,
    precoKg: 180,
    potenciaw: 10,
    horas: 2,
    valorKwh: 2,
    desgaste: 3,
    maoHora: 1,
    margem: 0.6
};

try {
    const result = mathjs.evaluate(formula, scope);
    console.log("Result:", result);
    console.log("Type of result:", typeof result);
    console.log("IsNaN:", isNaN(result));
} catch (e) {
    console.error("Error:", e.message);
}
