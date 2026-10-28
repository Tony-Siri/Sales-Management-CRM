/// <reference path="../pb_data/types.d.ts" />
//
// Fix: plans had UNIQUE (owner, date). Deleting a user clears `owner` on their
// plans, so the second removed user with a plan on the same day as an earlier
// removed user could not be deleted ("Value must be unique"). Uniqueness now
// applies only to plans that still have an owner.

migrate((app) => {
  const plans = app.findCollectionByNameOrId("plans");
  plans.indexes = plans.indexes
    .filter((i) => !/idx_plans_owner_date/.test(i))
    .concat(["CREATE UNIQUE INDEX idx_plans_owner_date ON plans (owner, date) WHERE owner != ''"]);
  app.save(plans);
}, (app) => {
  const plans = app.findCollectionByNameOrId("plans");
  plans.indexes = plans.indexes
    .filter((i) => !/idx_plans_owner_date/.test(i))
    .concat(["CREATE UNIQUE INDEX idx_plans_owner_date ON plans (owner, date)"]);
  app.save(plans);
});
