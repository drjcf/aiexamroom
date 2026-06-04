import { CurriculumEditor } from '@edai/lms';
export default function Page({ params }: { params: { curriculumId: string } }) {
  return <CurriculumEditor curriculumId={params.curriculumId} />;
}
