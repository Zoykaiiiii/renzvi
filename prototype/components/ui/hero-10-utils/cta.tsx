import Magnet from "@/components/Magnet"

// Bouton d'appel du héros (Hero10). Le composant fourni attendait ce fichier sans le donner :
// il reprend les boutons de la landing (.btn, app/globals.css) au lieu du Button shadcn, pour garder la police et la forme du site.
export type CtaProps = {
  ctaEnabled: boolean
  text: string
  link: string
  variant?: "default" | "outline"
  size?: "default"
}

// Le bouton principal garde l'aimant de l'ancien héros (components/Magnet.tsx) : il suit un peu le pointeur qui s'approche.
export function Cta({ cta }: Readonly<{ cta: CtaProps }>) {
  if (cta.variant === "outline")
    return <a href={cta.link} className="btn btn-soft">{cta.text}</a>
  return (
    <Magnet padding={70} magnetStrength={3}>
      <a href={cta.link} className="btn btn-accent">{cta.text}</a>
    </Magnet>
  )
}
