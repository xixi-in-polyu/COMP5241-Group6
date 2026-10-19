CREATE UNIQUE INDEX "Assignment_one_generating_per_course_key"
ON "Assignment"("courseId")
WHERE "status" = 'GENERATING';
