/**
 * Rule-based humanization — works offline without API keys.
 * Replaces common AI phrases, varies structure, adds natural rhythm.
 */

const REPLACEMENTS_EN: [RegExp, string[]][] = [
  [/it is important to note that/gi, ["worth mentioning", "I'd say", "honestly"]],
  [/in conclusion/gi, ["to wrap up", "all in all", "so yeah"]],
  [/furthermore/gi, ["also", "plus", "and"]],
  [/moreover/gi, ["on top of that", "what's more", "and"]],
  [/additionally/gi, ["also", "besides", "another thing"]],
  [/in today's world/gi, ["these days", "nowadays", "right now"]],
  [/plays a crucial role/gi, ["matters a lot", "is pretty important", "really counts"]],
  [/it is worth noting/gi, ["keep in mind", "note that", "worth saying"]],
  [/delve into/gi, ["look at", "dig into", "explore"]],
  [/utilize/gi, ["use", "work with", "apply"]],
  [/facilitate/gi, ["help", "make easier", "enable"]],
  [/comprehensive/gi, ["thorough", "full", "complete"]],
  [/robust/gi, ["solid", "strong", "reliable"]],
  [/leverage/gi, ["use", "take advantage of", "build on"]],
  [/paradigm/gi, ["model", "approach", "way of thinking"]],
  [/multifaceted/gi, ["complex", "many-sided", "varied"]],
  [/in the realm of/gi, ["in", "when it comes to", "around"]],
  [/underscores the importance/gi, ["shows how important", "highlights", "makes clear"]],
  [/navigate the complexities/gi, ["deal with the hard parts", "work through", "handle"]],
  [/at its core/gi, ["basically", "at heart", "really"]],
  [/therefore/gi, ["so", "that's why", "because of this"]],
  [/thus/gi, ["so", "which means", "and so"]],
  [/consequently/gi, ["as a result", "so", "because of that"]],
  [/nevertheless/gi, ["still", "even so", "but"]],
  [/in summary/gi, ["to sum up", "basically", "long story short"]],
  [/on the other hand/gi, ["but then", "though", "then again"]],
];

const REPLACEMENTS_ZH: [RegExp, string[]][] = [
  [/值得注意的是/g, ["说实话", "我觉得", "有意思的是"]],
  [/综上所述/g, ["总的来说", "说白了", "反正"]],
  [/总而言之/g, ["总之", "说到底", "简单来说"]],
  [/此外/g, ["另外", "还有", "再者"]],
  [/与此同时/g, ["同时", "这时候", "另一边"]],
  [/在当今社会/g, ["现在", "眼下", "如今"]],
  [/在当今世界/g, ["现在", "今天", "当下"]],
  [/发挥着重要作用/g, ["挺关键的", "作用不小", "很重要"]],
  [/具有重要意义/g, ["挺有意义", "值得重视", "不能忽视"]],
  [/不可或缺/g, ["少不了", "离不开", "必须有"]],
  [/毋庸置疑/g, ["不用说", "显然", "很明显"]],
  [/不言而喻/g, ["不用说", "明摆着", "一看就知道"]],
  [/深入探讨/g, ["好好聊聊", "仔细看看", "展开说"]],
  [/全方位/g, ["各方面", "整体上", "全面"]],
  [/多维度/g, ["多个角度", "不同层面", "各方面"]],
  [/有机结合/g, ["结合起来", "融合在一起", "配合好"]],
  [/赋能/g, ["帮助", "推动", "带动"]],
  [/助力/g, ["帮助", "推动", "促进"]],
  [/抓手/g, ["切入点", "突破口", "关键点"]],
  [/底层逻辑/g, ["根本原因", "核心道理", "本质"]],
  [/顶层设计/g, ["整体规划", "宏观布局", "总体规划"]],
  [/由此可见/g, ["所以", "这说明", "可以看出"]],
  [/换言之/g, ["也就是说", "说白了", "换句话说"]],
  [/日益凸显/g, ["越来越明显", "越发突出", "愈加显著"]],
  [/应运而生/g, ["随之出现", "自然产生", "就此诞生"]],
  [/砥砺前行/g, ["继续努力", "坚持下去", "往前走"]],
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function applyReplacements(
  text: string,
  replacements: [RegExp, string[]][]
): string {
  let result = text;
  for (const [pattern, alternatives] of replacements) {
    result = result.replace(pattern, () => pickRandom(alternatives));
  }
  return result;
}

function varySentenceLength(text: string): string {
  const sentences = text.split(/(?<=[.!?。！？])\s*/);
  if (sentences.length < 3) return text;

  const result: string[] = [];
  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i].trim();
    if (!s) continue;

    if (s.length > 80 && Math.random() < 0.3) {
      const mid = Math.floor(s.length / 2);
      const breakPoint = s.indexOf("，", mid) > 0 ? s.indexOf("，", mid) :
        s.indexOf(",", mid) > 0 ? s.indexOf(",", mid) : -1;
      if (breakPoint > 20 && breakPoint < s.length - 20) {
        result.push(s.slice(0, breakPoint + 1).trim());
        result.push(s.slice(breakPoint + 1).trim());
        continue;
      }
    }
    result.push(s);
  }
  return result.join(" ");
}

function addContractions(text: string): string {
  return text
    .replace(/\bIt is\b/g, "It's")
    .replace(/\bit is\b/g, "it's")
    .replace(/\bThey are\b/g, "They're")
    .replace(/\bthey are\b/g, "they're")
    .replace(/\bWe are\b/g, "We're")
    .replace(/\bwe are\b/g, "we're")
    .replace(/\bI am\b/g, "I'm")
    .replace(/\bdo not\b/g, "don't")
    .replace(/\bcannot\b/g, "can't")
    .replace(/\bwill not\b/g, "won't")
    .replace(/\bshould not\b/g, "shouldn't")
    .replace(/\bwould not\b/g, "wouldn't")
    .replace(/\bcould not\b/g, "couldn't")
    .replace(/\bis not\b/g, "isn't")
    .replace(/\bare not\b/g, "aren't")
    .replace(/\bhave not\b/g, "haven't")
    .replace(/\bhas not\b/g, "hasn't");
}

function softenTransitions(text: string): string {
  const softeners = [
    ["First,", "To start,"],
    ["Second,", "Next,"],
    ["Third,", "Then,"],
    ["Finally,", "Last thing —"],
    ["首先，", "一开始，"],
    ["其次，", "接着，"],
    ["最后，", "到最后，"],
  ];
  let result = text;
  for (const [formal, casual] of softeners) {
    if (Math.random() < 0.5) {
      result = result.replace(new RegExp(formal, "g"), casual);
    }
  }
  return result;
}

export type HumanizeIntensity = "light" | "standard" | "aggressive";

export function humanizeWithRules(
  text: string,
  intensity: HumanizeIntensity = "standard"
): string {
  if (!text.trim()) return text;

  let result = text;

  const passes = intensity === "light" ? 1 : intensity === "standard" ? 2 : 3;

  for (let i = 0; i < passes; i++) {
    result = applyReplacements(result, REPLACEMENTS_EN);
    result = applyReplacements(result, REPLACEMENTS_ZH);
  }

  if (intensity !== "light") {
    result = addContractions(result);
    result = softenTransitions(result);
  }

  if (intensity === "aggressive") {
    result = varySentenceLength(result);
  }

  result = result
    .replace(/  +/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return result;
}
