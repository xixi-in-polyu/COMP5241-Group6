import type { Metadata } from "next";

import InteractiveLearning from "./interactive-learning";

export const metadata: Metadata = {
  title: "Interactive Learning | COMP5241 Learning Platform",
  description:
    "Practice software engineering requirements discovery, reliability testing, and code review.",
};

export default function InteractiveLearningPage() {
  return <InteractiveLearning />;
}
