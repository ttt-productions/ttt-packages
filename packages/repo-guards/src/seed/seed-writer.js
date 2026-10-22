/**
 * @typedef {{ safeParse: (value: unknown) => { success: true, data: unknown } | { success: false, error: { issues: Array<{ path: PropertyKey[], message: string }> } }, shape?: unknown }} RegistrySchema
 */

/**
 * @param {Readonly<Record<string, RegistrySchema>>} schemas
 * @param {string} docPath
 * @returns {{ template: string, schema: RegistrySchema } | null}
 */
export function registeredSchemaForPath(schemas, docPath) {
  const segments = docPath.split('/');
  let best = null;
  for (const [template, schema] of Object.entries(schemas)) {
    const parts = template.split('/');
    if (parts.length !== segments.length) continue;
    let score = 0;
    let matches = true;
    for (let i = 0; i < parts.length; i += 1) {
      if (parts[i].startsWith('{') && parts[i].endsWith('}')) continue;
      if (parts[i] !== segments[i]) {
        matches = false;
        break;
      }
      score += 1;
    }
    if (matches && (!best || score > best.score)) best = { score, template, schema };
  }
  return best ? { template: best.template, schema: best.schema } : null;
}

/**
 * @param {object} options
 * @param {Readonly<Record<string, RegistrySchema>>} options.schemas
 * @param {(docPath: string, data: Record<string, unknown>, merge: boolean) => Promise<void>} options.write
 * @param {string} options.registryName
 * @returns {{
 *   setSeededDoc: (docPath: string, doc: Record<string, unknown>) => Promise<void>,
 *   mergeSeededDoc: (docPath: string, patch: Record<string, unknown>) => Promise<void>,
 * }}
 */
export function createRegistrySeedWriter({ schemas, write, registryName }) {
  const registered = (docPath, verb) => {
    const found = registeredSchemaForPath(schemas, docPath);
    if (!found) {
      throw new Error(
        `Cannot ${verb} unregistered Firestore path ${docPath}. Add its canonical document schema ` +
          `and registry binding in ${registryName} first.`,
      );
    }
    return found.schema;
  };

  const setSeededDoc = async (docPath, doc) => {
    const parsed = registered(docPath, 'seed').safeParse(doc);
    if (!parsed.success) {
      throw new Error(
        `Seed fixture does not match its ${registryName} schema: ${docPath}\n` +
          parsed.error.issues
            .map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
            .join('\n') +
          '\nFix the fixture to a shape a real writer produces, or add the field to the ' +
          `document schema in ${registryName} first.`,
      );
    }
    await write(docPath, /** @type {Record<string, unknown>} */ (parsed.data), false);
  };

  const mergeSeededDoc = async (docPath, patch) => {
    const schema = registered(docPath, 'patch');
    const shape =
      schema && typeof schema === 'object' && 'shape' in schema ? schema.shape : undefined;
    if (!shape || typeof shape !== 'object') {
      throw new Error(
        `Cannot check a seed patch against ${docPath}: its ${registryName} schema exposes no readable ` +
          'shape (a union, or a preprocess/pipe/effects wrapper). Seed the whole document with ' +
          `setSeededDoc(), which parses the whole shape, or give the document a plain object schema in ${registryName}.`,
      );
    }
    const undeclared = Object.keys(patch).filter((key) => !(key in shape));
    if (undeclared.length) {
      throw new Error(
        `Seed patch writes fields the ${registryName} schema does not declare on ${docPath}: ${undeclared.join(', ')}.\n` +
          `Add the field to the document schema in ${registryName} first.`,
      );
    }
    await write(docPath, patch, true);
  };

  return { setSeededDoc, mergeSeededDoc };
}
