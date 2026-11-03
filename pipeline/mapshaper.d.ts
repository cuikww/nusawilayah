// mapshaper ships no types; the pipeline only uses applyCommands.
declare module 'mapshaper' {
  const mapshaper: { applyCommands(commands: string, input: Record<string, unknown>): Promise<Record<string, string>> };
  export default mapshaper;
}
