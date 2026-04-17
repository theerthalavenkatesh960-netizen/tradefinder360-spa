import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';

type Tone = 'positive' | 'warning' | 'neutral';

interface InsightBannerProps {
  title: string;
  message: string;
  tone?: Tone;
}

const toneClasses: Record<Tone, string> = {
  positive: 'bg-green-500/10 border-green-500/30 text-green-300',
  warning: 'bg-amber-500/10 border-amber-500/30 text-amber-200',
  neutral: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-200',
};

const toneIcon: Record<Tone, typeof Info> = {
  positive: CheckCircle2,
  warning: AlertTriangle,
  neutral: Info,
};

export const InsightBanner = ({ title, message, tone = 'neutral' }: InsightBannerProps) => {
  const Icon = toneIcon[tone];

  return (
    <div className={`rounded-xl border p-4 ${toneClasses[tone]}`}>
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 mt-0.5" />
        <div>
          <p className="font-semibold">{title}</p>
          <p className="text-sm opacity-90 mt-1">{message}</p>
        </div>
      </div>
    </div>
  );
};
