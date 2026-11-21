// Fast CSV reader — written from the bounty spec.
// Fast path: per record, locate the next LF with indexOf, slice the line,
// verify it holds no '"' and no stray '\r' with two bounded indexOf calls,
// then split the line on ','. Anything with quotes or stray CRs falls back
// to a charCodeAt scanner that builds field values from slices.

export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const len = text.length;
  const rows = [];
  const errors = [];
  let columns = header ? [] : null;
  let headerPending = header;
  let width = -1;
  let pos = len > 0 && text.charCodeAt(0) === 0xfeff ? 1 : 0;
  let line = 1;
  let recordLine = 1;
  let recordRow = 0;
  let fieldVal = '';
  let fieldQuoted = false;
  let lastAdded = 0;

  // Unquoted field reader. End codes: 0 = comma, 1 = line break, 2 = end.
  // Values are built from slices; stray CRs flush the current segment and
  // are dropped (with an error). lastAdded counts kept chars only.
  function readUnquoted(startVal) {
    let val = startVal;
    let seg = pos;
    let added = 0;
    while (pos < len) {
      const c = text.charCodeAt(pos);
      if (c === 44) {
        fieldVal = val + text.slice(seg, pos);
        lastAdded = added + pos - seg;
        pos++;
        return 0;
      }
      if (c === 10) {
        fieldVal = val + text.slice(seg, pos);
        lastAdded = added + pos - seg;
        pos++;
        line++;
        return 1;
      }
      if (c === 13) {
        if (pos + 1 < len && text.charCodeAt(pos + 1) === 10) {
          fieldVal = val + text.slice(seg, pos);
          lastAdded = added + pos - seg;
          pos += 2;
          line++;
          return 1;
        }
        errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
        val += text.slice(seg, pos);
        added += pos - seg;
        pos++;
        seg = pos;
        continue;
      }
      pos++;
    }
    fieldVal = val + text.slice(seg, pos);
    lastAdded = added + pos - seg;
    return 2;
  }

  // Quoted field reader. Normalizes CR/CRLF inside quotes to '\n'.
  // Unterminated quotes rewind to just after the opening quote and are
  // re-read as unquoted with a literal '"' start value.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    pos++;
    let val = '';
    let seg = pos;
    let closed = false;
    while (pos < len) {
      const c = text.charCodeAt(pos);
      if (c === 34) {
        if (pos + 1 < len && text.charCodeAt(pos + 1) === 34) {
          val += text.slice(seg, pos) + '"';
          pos += 2;
          seg = pos;
        } else {
          pos++;
          closed = true;
          break;
        }
      } else if (c === 13) {
        val += text.slice(seg, pos) + '\n';
        line++;
        pos += pos + 1 < len && text.charCodeAt(pos + 1) === 10 ? 2 : 1;
        seg = pos;
      } else if (c === 10) {
        line++;
        pos++;
      } else {
        pos++;
      }
    }
    if (!closed) {
      pos = open + 1;
      line = openLine;
      fieldQuoted = false;
      errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
      return readUnquoted('"');
    }
    val += text.slice(seg, pos - 1); // pos is one past the closing quote; exclude it
    fieldVal = val;
    fieldQuoted = true;
    if (pos >= len) return 2;
    const c = text.charCodeAt(pos);
    if (c === 44) {
      pos++;
      return 0;
    }
    if (c === 10) {
      pos++;
      line++;
      return 1;
    }
    if (c === 13 && pos + 1 < len && text.charCodeAt(pos + 1) === 10) {
      pos += 2;
      line++;
      return 1;
    }
    // Junk after the closing quote: continue as unquoted from the value.
    const end = readUnquoted(val);
    if (lastAdded > 0) {
      errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
    }
    return end;
  }

  while (pos < len) {
    // Skip empty lines at record start (LF and CRLF only).
    while (pos < len) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos++;
        line++;
      } else if (c === 13 && pos + 1 < len && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line++;
      } else {
        break;
      }
    }
    if (pos >= len) break;
    recordLine = line;
    recordRow = headerPending ? null : rows.length;

    // Fast path: a line with no quotes and no stray CR.
    const nl = text.indexOf('\n', pos);
    const lineEnd = nl === -1 ? len : nl;
    const lineStr = text.slice(pos, lineEnd);
    let fields = null;
    if (lineStr.indexOf('"') === -1) {
      const cr = lineStr.indexOf('\r');
      if (cr === -1 || (cr === lineStr.length - 1 && nl !== -1)) {
        fields = (cr === -1 ? lineStr : lineStr.slice(0, cr)).split(',');
        pos = nl === -1 ? len : nl + 1;
        if (nl !== -1) line++;
      }
    }

    if (fields === null) {
      // Slow path: per-character scan for quotes / stray CRs.
      fields = [];
      let sawQuoted = false;
      for (;;) {
        let end;
        if (text.charCodeAt(pos) === 34) {
          end = readQuoted();
        } else {
          fieldQuoted = false;
          end = readUnquoted('');
        }
        fields.push(fieldVal);
        if (fieldQuoted) sawQuoted = true;
        if (end !== 0) break;
      }
      if (fields.length === 1 && fields[0] === '' && !sawQuoted) continue;
    } else if (fields.length === 1 && fields[0] === '') {
      continue;
    }

    if (width === -1) width = fields.length;
    if (headerPending) {
      columns = fields;
      headerPending = false;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.slice(width) });
      fields.length = width;
    }
    rows.push(fields);
  }

  return { columns, rows, errors };
}
