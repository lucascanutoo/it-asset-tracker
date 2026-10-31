const express = require('express');
const { authorize } = require('../auth');

function createMaquinasRouter(controller) {
  const router = express.Router();
  const handle = (fn) => (req, res, next) => Promise.resolve()
    .then(() => fn(req, res))
    .catch(next);

  router.get('/', handle(controller.list));
  router.get('/:id', handle(controller.get));
  router.post('/', authorize('editor', 'admin'), handle(controller.create));
  router.put('/:id', authorize('editor', 'admin'), handle(controller.update));
  router.delete('/:id', authorize('admin'), handle(controller.remove));

  return router;
}

module.exports = { createMaquinasRouter };
