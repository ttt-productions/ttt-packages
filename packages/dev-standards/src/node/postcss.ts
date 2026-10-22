export interface PostcssConfig {
  plugins: Record<string, Record<string, unknown>>;
}

export function createPostcssConfig(): PostcssConfig {
  return { plugins: { '@tailwindcss/postcss': {} } };
}
