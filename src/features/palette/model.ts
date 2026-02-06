export type PaletteCommand = {
  id: string;
  title: string;
  subtitle?: string;
  run: () => void;
};

export function filterPaletteCommands(commands: PaletteCommand[], query: string): PaletteCommand[] {
  const q = query.trim().toLowerCase();
  if (q === "") return commands;
  return commands.filter((item) => {
    const target = (item.title + " " + (item.subtitle ?? "")).toLowerCase();
    return target.includes(q);
  });
}

