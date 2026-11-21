import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PricingSection, type PricingPlan } from "@/components/ui/pricing";
import "./pricing.css";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Tarifs · Renzvi",
  description: "Découvre les offres Gratuit, Pro et Worker de Renzvi.",
};

const plans: PricingPlan[] = [
  {
    name: "Gratuit",
    price: "0",
    yearlyPrice: "0",
    period: "mois",
    description: "Organise ton quotidien.",
    features: ["Minuteur, tâches, notes et habitudes", "Cahier, flashcards et révisions du jour", "Pages, modes et fonds d’écran"],
    buttonText: "Créer mon espace",
    href: "/login.html",
  },
  {
    name: "Pro",
    price: "7.99",
    yearlyPrice: "6.39",
    annualTotal: "76.70",
    period: "mois",
    description: "Révise tes cours avec l’IA.",
    features: ["Tout le plan Gratuit", "Cartes, quiz et résumés à partir de tes cours", "Schémas et espace Study", "Polices perso et fond d’écran en vidéo"],
    buttonText: "Commencer gratuitement",
    href: "/login.html",
    isPopular: true,
  },
  {
    name: "Worker",
    price: "15.99",
    yearlyPrice: "12.79",
    annualTotal: "153.50",
    period: "mois",
    description: "Pour les gros volumes de cours.",
    features: ["Tout le plan Pro", "Zvi, l’assistant de ton tableau", "4 fois plus de crédits IA que Pro", "Cours illimités et PDF jusqu’à 300 pages"],
    buttonText: "Commencer gratuitement",
    href: "/login.html",
  },
];

export default function TarifsPage() {
  return (
    <main className={`pricing-reference min-h-screen bg-background text-foreground ${geist.className}`}>
      <div className="container mx-auto px-4 pt-5 md:px-6">
        <Link href="/" className="inline-flex items-center gap-2 py-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Retour à l’accueil
        </Link>
      </div>
      <PricingSection
        plans={plans}
        title="Find the Perfect Plan"
        description={"Choisis l’offre qui te convient.\nLes abonnements payants ouvriront au lancement."}
        currency="EUR"
        locale="fr-FR"
      />
    </main>
  );
}
