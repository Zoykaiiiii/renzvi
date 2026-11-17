'use client'

// Héros de la landing, d'après le composant Hero10 fourni (21st.dev). Changements pour Renzvi :
// - les trois photos deviennent trois cadres (`media`), vides par défaut, chacun remplaçable par une capture ou une vidéo muette ;
// - couleurs et police du titre limitées au héros (.hero, app/globals.css), au lieu des jetons shadcn ;
// - pas de « social proof » chiffré ni de mot surligné ; react-wrap-balancer remplacé par text-wrap: balance (CSS).
import * as React from 'react'
import { MotionConfig, motion, type Variants } from 'motion/react'

import { cn } from '@/lib/utils'

import { Cta, type CtaProps } from '@/components/ui/hero-10-utils/cta'

/** Contenu d'un cadre. `null` : cadre vide, complet tel quel. */
export type HeroMedia =
  | { type: 'image'; src: string; alt: string }
  | { type: 'video'; src: string; poster?: string; label: string }
  | null

export interface Hero10Props {
  title: string
  titleLine2Prefix?: string
  description: string
  /** Exactement trois cadres : gauche, centre (devant), droite. */
  media: [HeroMedia, HeroMedia, HeroMedia]
  animation?: 'none' | 'subtle'
  primaryCTA: CtaProps
  secondaryCTA?: CtaProps
  variant?: 'standard' | 'compact'
  id?: string
}

const variantStyles = {
  standard: {
    // Le haut laisse la place à la barre de navigation fixe (68 px).
    section: 'pt-28 pb-16 sm:pt-36 sm:pb-24',
    title: 'hero-title',
    description: 'max-w-xl',
    header: 'gap-5',
    content: 'gap-10 sm:gap-12',
    // Sous 1024 px, l'éventail est resserré pour que les cadres de côté restent dans l'écran.
    fan: 'w-[84%] max-w-3xl lg:w-full',
    fanCard: 'aspect-4/5',
  },
  compact: {
    section: 'pt-24 pb-12 sm:pt-28 sm:pb-20',
    title: 'hero-title hero-title-compact',
    description: 'max-w-md text-small',
    header: 'gap-4',
    content: 'gap-6 sm:gap-8',
    fan: 'w-[84%] max-w-2xl lg:w-full',
    fanCard: 'aspect-4/5',
  },
} as const

// Ordre, largeurs et chevauchement du composant fourni (rotation et hauteur : .hero-frame en CSS) ; chevauchement réduit sur téléphone.
const fanSlots = [
  { width: 'w-[38%]', layout: '-mr-4 sm:-mr-8 z-10', x: 48 },
  { width: 'w-[42%]', layout: 'z-20', x: 0 },
  { width: 'w-[38%]', layout: '-ml-4 sm:-ml-8 z-10', x: -48 },
]

const fanContainer: Variants = {
  hidden: { opacity: 0, y: 12, filter: 'blur(6px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1],
      delay: 0.4,
      delayChildren: 0.5,
      staggerChildren: 0.1,
    },
  },
}

// L'inclinaison et la hauteur de chaque cadre sont en CSS (.hero-frame, app/globals.css), réduites sur téléphone ;
// l'animation ne fait que rapprocher les cadres de côté.
const fanCard: Variants = {
  hidden: (slot: (typeof fanSlots)[number]) => ({ x: slot.x }),
  visible: { x: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
}

const container: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
}

const item: Variants = {
  hidden: { opacity: 0, y: 12, filter: 'blur(6px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
}

// Titre, phrase et appel : visibles dès la première image (même sans JavaScript), ils glissent seulement de quelques pixels.
const rise: Variants = {
  hidden: { y: 12 },
  visible: { y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
}

function Reveal({
  active,
  variants,
  className,
  children,
}: Readonly<{
  active: boolean
  variants?: Variants
  className?: string
  children: React.ReactNode
}>) {
  if (!active) return <div className={className}>{children}</div>

  return (
    <motion.div variants={variants ?? item} className={className}>
      {children}
    </motion.div>
  )
}

// Le contenu d'un cadre remplit sa surface (même recadrage, mêmes coins) ; vide, la surface seule suffit.
function Media({ media }: Readonly<{ media: HeroMedia }>) {
  if (!media) return null
  if (media.type === 'video')
    return (
      <video
        src={media.src}
        poster={media.poster}
        aria-label={media.label}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        className="size-full object-cover"
      />
    )
  return <img src={media.src} alt={media.alt} decoding="async" className="size-full object-cover" />
}

function ImageFan({
  media,
  cardAspect,
  animate,
}: Readonly<{
  media: HeroMedia[]
  cardAspect: string
  animate: boolean
}>) {
  return (
    <motion.div
      className="relative flex w-full items-center justify-center"
      variants={fanContainer}
      initial={animate ? 'hidden' : false}
      whileInView={animate ? 'visible' : undefined}
      animate={animate ? undefined : 'visible'}
      viewport={{ once: true, margin: '-80px' }}
    >
      {media.slice(0, 3).map((m, i) => {
        const slot = fanSlots[i] ?? fanSlots[1]
        return (
          <motion.div
            key={i}
            custom={slot}
            variants={fanCard}
            data-hero-slot={i}
            aria-hidden={m ? undefined : true}
            className={cn('hero-frame relative shrink-0 overflow-hidden', cardAspect, slot.width, slot.layout)}
          >
            <Media media={m} />
          </motion.div>
        )
      })}
    </motion.div>
  )
}

export function Hero10({
  title,
  titleLine2Prefix,
  description,
  media,
  animation = 'none',
  primaryCTA,
  secondaryCTA,
  variant = 'standard',
  id,
}: Readonly<Hero10Props>) {
  // Mouvement réduit : géré par MotionConfig (fondu seul, sans déplacement). Ne pas brancher la structure dessus :
  // le serveur ne connaît pas ce réglage, et un rendu différent côté navigateur garderait le contenu caché.
  const animate = animation === 'subtle'
  const vs = variantStyles[variant]

  const titleElement = title && (
    <h1 className={vs.title}>
      {title}
      {titleLine2Prefix && (
        <>
          <br />
          {titleLine2Prefix}
        </>
      )}
    </h1>
  )

  const descriptionElement = description && (
    <p className={cn('hero-text text-balance', vs.description)}>{description}</p>
  )

  const ctasElement = (primaryCTA?.ctaEnabled || secondaryCTA?.ctaEnabled) && (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-3">
      {primaryCTA?.ctaEnabled && <Cta cta={primaryCTA} />}
      {secondaryCTA?.ctaEnabled && (
        <Cta cta={{ ...secondaryCTA, variant: secondaryCTA.variant ?? 'outline' }} />
      )}
    </div>
  )

  return (
    <MotionConfig reducedMotion="user">
    <section id={id} className="hero bg-white relative isolate w-full overflow-hidden">
      <motion.div
        className={cn(
          'relative z-10 mx-auto flex max-w-6xl flex-col items-center px-[var(--m)] text-center',
          vs.section,
          vs.content,
        )}
        variants={animate ? container : undefined}
        initial={animate ? 'hidden' : false}
        whileInView={animate ? 'visible' : undefined}
        viewport={{ once: true, margin: '-80px' }}
      >
        <Reveal active={animate} variants={rise} className={cn('flex w-full max-w-2xl flex-col items-center', vs.header)}>
          {titleElement}
          {descriptionElement}
        </Reveal>

        <Reveal active={animate} variants={rise} className="flex flex-col items-center gap-4">
          {ctasElement}
        </Reveal>

        <div className={cn('mx-auto', vs.fan)}>
          <ImageFan media={media} cardAspect={vs.fanCard} animate={animate} />
        </div>
      </motion.div>
    </section>
    </MotionConfig>
  )
}

export default Hero10
