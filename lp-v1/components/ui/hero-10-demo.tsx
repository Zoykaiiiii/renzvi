import { Hero10, type Hero10Props } from '@/components/ui/hero-10'

const values = {
  title: 'Tes outils,',
  titleLine2Prefix: 'au même endroit',
  description:
    'Renzvi réunit tâches, notes, minuteur et musique sur un dashboard que tu composes comme un moodboard : ton fond, tes couleurs, tes widgets.',
  media: [null, null, null],
  animation: 'subtle',
  primaryCTA: { ctaEnabled: true, text: 'Créer mon espace', link: '/login.html' },
} satisfies Hero10Props

export default function Hero10Example() {
  return <Hero10 {...values} />
}
