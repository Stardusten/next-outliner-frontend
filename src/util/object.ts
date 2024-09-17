export const insertAfter = (obj: object, entriesToInsert: [string, any][], afterKey: string) => {
  const entries = Object.entries(obj);
  const i = entries.findIndex((e) => e[0] == afterKey);
  if (i == -1) {
    for (const [key, value] of entriesToInsert) {
      (obj as any)[key] = value;
    }
  } else {
    for (let j = i + 1; j < entries.length; j++) {
      const [key] = entries[j];
      delete (obj as any)[key];
    }
    for (const [key, value] of entriesToInsert) {
      (obj as any)[key] = value;
    }
    for (let j = i + 1; j < entries.length; j++) {
      const [key, value] = entries[j];
      (obj as any)[key] = value;
    }
  }
};

export const insertBefore = (obj: object, entriesToInsert: [string, any][], beforeKey: string) => {
  const entries = Object.entries(obj);
  const i = entries.findIndex((e) => e[0] == beforeKey);
  if (i == -1) {
    for (const [key, value] of entriesToInsert) {
      (obj as any)[key] = value;
    }
  } else {
    for (let j = i; j < entries.length; j++) {
      const [key] = entries[j];
      delete (obj as any)[key];
    }
    for (const [key, value] of entriesToInsert) {
      (obj as any)[key] = value;
    }
    for (let j = i; j < entries.length; j++) {
      const [key, value] = entries[j];
      (obj as any)[key] = value;
    }
  }
};
