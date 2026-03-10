export const TITLE_AUTOPARSE_LIMIT = 70;

const normalizeText = (value) => String(value ?? '').replace(/\r\n?/g, '\n').trim();

const splitByFirstSentence = (value) => {
  const normalized = String(value ?? '');
  const match = normalized.match(/^(.+?[.!?\u2026])(?:\s|$)/);
  if (!match?.[1]) return null;

  const sentence = match[1].trim();
  const remainder = normalized.slice(match[0].length).trim();
  return { sentence, remainder };
};

export const stripLeadingTitleFromBody = (title, body) => {
  const normalizedTitle = normalizeText(title);
  const normalizedBody = normalizeText(body);

  if (!normalizedBody) return '';
  if (!normalizedTitle) return normalizedBody;

  const bodyLower = normalizedBody.toLowerCase();
  const titleLower = normalizedTitle.toLowerCase();

  if (bodyLower === titleLower) return '';
  if (!bodyLower.startsWith(titleLower)) return normalizedBody;

  return normalizedBody.slice(normalizedTitle.length).trimStart();
};

export const parsePostSingleText = (rawText, options = {}) => {
  const titleMax = options.titleMax ?? 100;
  const bodyMin = options.bodyMin ?? 10;
  const autolimit = options.autolimit ?? TITLE_AUTOPARSE_LIMIT;

  const normalized = normalizeText(rawText);
  if (!normalized) return { title: null, body: '' };

  if (normalized.includes('\n')) {
    const [firstLineRaw, ...rest] = normalized.split('\n');
    const firstLine = firstLineRaw.trim();
    const restBody = rest.join('\n').trim();

    if (firstLine && firstLine.length <= autolimit) {
      if (restBody.length >= bodyMin) {
        return { title: firstLine.slice(0, titleMax).trim(), body: restBody };
      }
      return { title: firstLine.slice(0, titleMax).trim(), body: normalized };
    }
    return { title: null, body: normalized };
  }

  const sentence = splitByFirstSentence(normalized);
  if (sentence && sentence.sentence.length <= autolimit) {
    if (sentence.remainder.length >= bodyMin) {
      return {
        title: sentence.sentence.slice(0, titleMax).trim(),
        body: normalized,
      };
    }
    return {
      title: sentence.sentence.slice(0, titleMax).trim(),
      body: normalized,
    };
  }

  const singleLineTitle = normalized.slice(0, titleMax).trim();
  if (singleLineTitle) {
    return { title: singleLineTitle, body: normalized };
  }
  return { title: null, body: normalized };
};

export const parseRequestSingleText = (rawText, options = {}) => {
  const titleMax = options.titleMax ?? 100;
  const autolimit = options.autolimit ?? TITLE_AUTOPARSE_LIMIT;

  const normalized = normalizeText(rawText);
  if (!normalized) return { title: '', body: '' };

  let titleCandidate = '';
  let bodyCandidate = '';

  if (normalized.includes('\n')) {
    const lines = normalized.split('\n');
    const firstNonEmptyIndex = lines.findIndex((line) => line.trim().length > 0);
    if (firstNonEmptyIndex >= 0) {
      const firstLine = lines[firstNonEmptyIndex].trim();
      if (firstLine && firstLine.length <= autolimit) {
        titleCandidate = firstLine;
        bodyCandidate = lines.slice(firstNonEmptyIndex + 1).join('\n').trim();
      }
    }
  }

  if (!titleCandidate) {
    const sentence = splitByFirstSentence(normalized);
    if (sentence?.sentence && sentence.sentence.length <= autolimit) {
      titleCandidate = sentence.sentence;
      bodyCandidate = sentence.remainder;
    }
  }

  if (!titleCandidate) {
    titleCandidate = normalized.slice(0, titleMax).trim();
    bodyCandidate = normalized.slice(titleCandidate.length).trim();
  }

  const title = titleCandidate.slice(0, titleMax).trim();
  const body = stripLeadingTitleFromBody(title, bodyCandidate);

  return {
    title,
    body,
  };
};

export const composeSingleTextFromTitleBody = (title, body) => {
  const normalizedTitle = String(title ?? '').trim();
  const normalizedBody = String(body ?? '').trim();

  if (normalizedTitle && normalizedBody) {
    const dedupedBody = stripLeadingTitleFromBody(normalizedTitle, normalizedBody);
    return dedupedBody ? `${normalizedTitle}\n\n${dedupedBody}` : normalizedTitle;
  }

  return normalizedBody || normalizedTitle;
};
