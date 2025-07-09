
if [ ! -d "$HOME/pgdb-data" ]; then
  initdb -D $HOME/pgdb-data
fi

# Start Postgres (on port 5433, in background)
pg_ctl -D $HOME/pgdb-data -o "-p 5433" -l $HOME/pgdb.log start
# Create test user and both dev and test databases if not exist
psql -p 5433 -U $USER -c "CREATE USER devuser WITH PASSWORD 'devpass';" || true
psql -p 5433 -U $USER -c "CREATE DATABASE babel_feed_dev OWNER devuser;" || true
psql -p 5433 -U $USER -c "CREATE DATABASE babel_feed_test OWNER devuser;" || true