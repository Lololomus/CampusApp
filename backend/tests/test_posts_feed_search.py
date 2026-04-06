import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from sqlalchemy.dialects import postgresql

from app.main import get_posts_feed
from app.crud import posts as posts_crud


class _EmptyScalarResult:
    def scalars(self):
        return self

    def all(self):
        return []


class PostsFeedSearchRouteTests(unittest.IsolatedAsyncioTestCase):
    async def test_route_forwards_search_and_other_filters_to_crud(self):
        request = SimpleNamespace()
        db = object()

        with patch('app.main.check_rate_limit', new=AsyncMock()), patch('app.main.crud.get_posts', new=AsyncMock(return_value=[])) as mocked_get_posts:
            payload = await get_posts_feed(
                request=request,
                skip=5,
                limit=10,
                category='news',
                university='Campus Uni',
                institute='Math',
                campus_id='campus-1',
                city='Moscow',
                tags='help,urgent',
                search='notes',
                date_range='week',
                sort='popular',
                viewer_city='Moscow',
                user=None,
                db=db,
            )

        self.assertEqual(payload, {'items': [], 'total': 0, 'has_more': False})
        mocked_get_posts.assert_awaited_once_with(
            db,
            skip=5,
            limit=10,
            category='news',
            university='Campus Uni',
            institute='Math',
            campus_id='campus-1',
            city='Moscow',
            tags='help,urgent',
            search='notes',
            date_range='week',
            sort='popular',
            current_user_id=None,
            viewer_city='Moscow',
        )


class PostsFeedSearchCrudTests(unittest.IsolatedAsyncioTestCase):
    async def test_crud_adds_search_clause_without_dropping_other_filters(self):
        fake_db = SimpleNamespace(execute=AsyncMock(return_value=_EmptyScalarResult()))

        await posts_crud.get_posts(
            fake_db,
            skip=0,
            limit=20,
            category='news',
            search=' lecture ',
            sort='popular',
        )

        query = fake_db.execute.await_args.args[0]
        compiled = str(
            query.compile(
                dialect=postgresql.dialect(),
                compile_kwargs={'literal_binds': True},
            )
        )

        self.assertIn('ILIKE', compiled)
        self.assertIn('%lecture%', compiled)
        self.assertIn('news', compiled)


if __name__ == '__main__':
    unittest.main()
