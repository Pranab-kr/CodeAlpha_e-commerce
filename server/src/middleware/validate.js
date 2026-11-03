export function validate({ body, params, query } = {}) {
  return (req, res, next) => {
    try {
      if (body) req.body = body.parse(req.body ?? {});
      if (params) req.params = params.parse(req.params);
      if (query) {
        Object.defineProperty(req, 'query', {
          value: query.parse(req.query),
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
