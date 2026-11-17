// Alias shadcn « @/lib/utils » attendu par les composants copiés (components/ui/live-orb.tsx).
// shortcut: simple concaténation sans tailwind-merge (classes en conflit non fusionnées) ; ajouter clsx + tailwind-merge si un composant en dépend.
export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}
