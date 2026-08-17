import { createHash } from "node:crypto";

export type BallotReviewCategory = {
  id: string;
  name: string;
  displayOrder: number;
  maxNomineesPerVoter: number | null;
};
export type BallotReviewNominee = {
  id: string;
  categoryId: string;
  name: string;
  displayOrder: number;
};

export function getBallotRosterHash(
  categories: BallotReviewCategory[],
  nominees: BallotReviewNominee[],
) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        categories: categories.map((category) => [
          category.id,
          category.name,
          category.displayOrder,
          category.maxNomineesPerVoter,
        ]),
        nominees: nominees.map((nominee) => [
          nominee.id,
          nominee.categoryId,
          nominee.name,
          nominee.displayOrder,
        ]),
      }),
    )
    .digest("hex");
}

export function getInvalidBallotCategoryNames(
  categories: BallotReviewCategory[],
  nominees: BallotReviewNominee[],
) {
  return categories
    .filter(
      (category) =>
        !nominees.some((nominee) => nominee.categoryId === category.id),
    )
    .map((category) => category.name);
}
