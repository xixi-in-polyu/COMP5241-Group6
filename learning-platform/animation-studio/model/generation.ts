import type { AnimationProject, GenerationAdapter, GenerationInput } from './types';
import { assertValidProject } from './validator';

export class LocalExampleGenerationAdapter implements GenerationAdapter {
  id = 'local-example';
  label = 'Local example adapter';

  constructor(private readonly factory: () => AnimationProject) {}

  async generate(input: GenerationInput): Promise<AnimationProject> {
    const project = structuredClone(this.factory());
    project.sourceDocuments = [input.document];
    project.knowledgeNodes = input.knowledgeNodes;
    project.locale = input.locale;
    assertValidProject(project);
    return project;
  }
}
