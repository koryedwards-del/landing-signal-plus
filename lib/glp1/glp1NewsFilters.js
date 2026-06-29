/** Numbered hooks, "best/top N", comparison bait — drop on sight. */
const LISTICLE_PATTERNS = [
  /\b\d+\s+(best|top|easy|simple|surprising|science-backed|must-try|must-read)\b/i,
  /\b(best|top)\s+\d+\b/i,
  /\b\d+\s+(ways|tips|things|reasons|habits|pills|foods|exercises|moves|steps)\b/i,
  /\bwhich is the best\b/i,
  /\bthat work:\s*/i,
  /\branked\b/i,
  /\bcountdown\b/i,
  /\bslide show\b|\bslideshow\b/i,
  /\byou need to know\b/i,
  /\bhere'?s what matters more\b/i,
];

function isListicleHeadline(title) {
  return LISTICLE_PATTERNS.some((pattern) => pattern.test(title));
}

module.exports = {
  isListicleHeadline,
};
