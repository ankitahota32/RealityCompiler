import { Challenges } from '@/components/site/Challenges';
import { Faq } from '@/components/site/Faq';
import { Hero } from '@/components/site/Hero';
import { SiteFooter } from '@/components/site/SiteFooter';
import { WorkingFlow } from '@/components/site/WorkingFlow';

/** Landing page. "Get started" leads to the wizard at /app. */
export default function LandingPage() {
  return (
    <>
      <main className="flex flex-col">
        <Hero />
        <WorkingFlow />
        <Challenges />
        <Faq />
      </main>
      <SiteFooter />
    </>
  );
}
