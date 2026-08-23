import type { AppLanguage } from "../hooks/useAppPreferences";
import { APP_TEXT } from "../i18n/uiText";
import "./OnboardingGuide.scss";

export type OnboardingStage = "topic" | "branch" | "arrange";

type Props = {
  stage: OnboardingStage;
  language: AppLanguage;
  onAddBranch: () => void;
  onComplete: () => void;
};

export function OnboardingGuide({
  stage,
  language,
  onAddBranch,
  onComplete,
}: Props) {
  const text = APP_TEXT[language].onboarding;
  const content =
    stage === "topic"
      ? { title: text.topic, body: text.typeTopic, action: null, onAction: null }
      : stage === "branch"
        ? { title: text.branch, body: text.detail, action: text.addBranch, onAction: onAddBranch }
        : { title: text.arrange, body: text.detail, action: text.finish, onAction: onComplete };

  return (
    <aside className="onboardingGuide" aria-label={content.title} aria-live="polite">
      <span className="onboardingStep">{stage === "topic" ? "01" : stage === "branch" ? "02" : "03"}</span>
      <div>
        <strong>{content.title}</strong>
        <p>{content.body}</p>
      </div>
      {content.action && content.onAction ? (
        <button type="button" onClick={content.onAction}>{content.action}</button>
      ) : null}
    </aside>
  );
}
