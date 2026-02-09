# Migration Guide: Lovable → FastAPI Backend

This guide walks through migrating from the Lovable backend to the new FastAPI backend.

## Prerequisites

Before starting the migration:

- [ ] Backup Lovable database (Supabase export)
- [ ] Document current API endpoints used by frontend
- [ ] Test environment ready for validation
- [ ] New backend environment variables configured

## Migration Steps

### 1. Analyze Current Lovable Backend

#### Document API Endpoints

List all endpoints currently used by the frontend:

```bash
cd insight-weaver
grep -r "api\." src/ --include="*.ts" --include="*.tsx" | grep -o "api\.[a-zA-Z]*" | sort -u
```

Common endpoints to look for:
- User authentication
- Dataset upload/management
- Analysis requests
- LLM interactions
- Job status checks

#### Export Supabase Schema

1. Login to Supabase Dashboard
2. Navigate to SQL Editor
3. Export current schema:
   ```sql
   -- Get table definitions
   SELECT tablename FROM pg_tables WHERE schemaname = 'public';

   -- Get full schema
   pg_dump --schema-only your_database_url
   ```

### 2. Prepare New Backend

#### Configure Environment

1. Copy environment template:
   ```bash
   cd backend
   cp .env.example .env
   ```

2. Fill in credentials from Lovable:
   ```env
   SUPABASE_URL=<from Lovable>
   SUPABASE_KEY=<from Lovable>
   SUPABASE_JWT_SECRET=<from Lovable>
   LLM_API_KEY=<your XAI key>
   ```

#### Verify Supabase Compatibility

The new backend expects these tables (adapt from Lovable schema):

**jobs** table:
```sql
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  status TEXT NOT NULL, -- created, running, completed, failed
  dataset_reference TEXT,
  prompt TEXT,
  results JSONB,
  provenance JSONB,
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**decision_logs** table (optional):
```sql
CREATE TABLE IF NOT EXISTS decision_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES jobs(id),
  rule_id TEXT,
  library TEXT,
  function TEXT,
  confidence FLOAT,
  source TEXT,
  timestamp TIMESTAMP DEFAULT NOW()
);
```

**llm_call_logs** table (optional):
```sql
CREATE TABLE IF NOT EXISTS llm_call_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT,
  prompt TEXT,
  response TEXT,
  latency_ms FLOAT,
  metadata JSONB,
  timestamp TIMESTAMP DEFAULT NOW()
);
```

Run migrations if needed:
```bash
# Connect to Supabase
psql your_database_url

# Run migration scripts
\i migrations/001_create_jobs_table.sql
\i migrations/002_create_decision_logs.sql
\i migrations/003_create_llm_logs.sql
```

### 3. Start New Backend

```bash
cd backend
./scripts/dev-start.sh
```

Verify services are running:
```bash
# Check health
curl http://localhost:8000/api/health

# Check Python service
curl http://localhost:8001/health
```

### 4. Update Frontend Configuration

#### API Base URL

Update frontend environment variables or config:

**Before** (Lovable):
```env
VITE_API_URL=https://lovable-backend.example.com
```

**After** (FastAPI):
```env
VITE_API_URL=http://localhost:8000/api
```

#### API Endpoint Mapping

Map Lovable endpoints to FastAPI endpoints:

| Lovable Endpoint | FastAPI Endpoint | Notes |
|-----------------|------------------|-------|
| `/api/analyze` | `/api/analyze` | Compatible |
| `/api/decision` | `/api/decide` | Renamed |
| `/api/llm` | `/api/llm-proxy` | Centralized |
| `/api/jobs/:id` | `/api/jobs/:id` | Compatible |

#### Update API Calls

If using TypeScript client:

```typescript
// Before (Lovable)
const response = await api.decision({
  prompt: "...",
  schema: {...}
});

// After (FastAPI)
const response = await api.decide({
  prompt: "...",
  dataset_schema: {...}  // Note: renamed parameter
});
```

### 5. Test Critical Flows

#### Test Authentication

```bash
# Get JWT token from Supabase
TOKEN="your-jwt-token"

# Test authenticated request
curl -X POST http://localhost:8000/api/analyze \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dataset_reference": "test.csv",
    "prompt": "test analysis",
    "dataset_schema": {...}
  }'
```

#### Test Analysis Flow

1. **Decision Endpoint**:
   ```bash
   curl -X POST http://localhost:8000/api/decide \
     -H "Content-Type: application/json" \
     -d '{
       "prompt": "compare two groups",
       "dataset_schema": {
         "columns": [
           {"name": "group", "type": "categorical"},
           {"name": "value", "type": "numeric"}
         ]
       }
     }'
   ```

2. **Execution Endpoint**:
   ```bash
   curl -X POST http://localhost:8000/api/analyze \
     -H "Content-Type: application/json" \
     -d '{
       "dataset_reference": "data.csv",
       "prompt": "compare two groups",
       "dataset_schema": {...}
     }'
   ```

3. **Job Status**:
   ```bash
   curl http://localhost:8000/api/jobs/{job_id}
   ```

#### Test LLM Integration

```bash
curl -X POST http://localhost:8000/api/llm-proxy \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "test prompt",
    "max_tokens": 100
  }'
```

### 6. Validate Data Integrity

Compare results between Lovable and FastAPI:

1. **Run same analysis on both**:
   - Use identical dataset
   - Use same analysis request
   - Compare results

2. **Verify job records**:
   - Check Supabase jobs table
   - Verify provenance data
   - Confirm status updates

3. **Check plot outputs**:
   - Verify plots are generated
   - Check file paths are accessible
   - Validate plot quality

### 7. Performance Testing

```bash
# Load test decision endpoint
ab -n 100 -c 10 -T 'application/json' \
  -p decision_request.json \
  http://localhost:8000/api/decide

# Test analysis execution time
time curl -X POST http://localhost:8000/api/analyze \
  -H "Content-Type: application/json" \
  -d @analysis_request.json
```

### 8. Deploy to Staging

1. **Update docker-compose for staging**:
   ```yaml
   # docker-compose.staging.yml
   services:
     api-gateway:
       environment:
         - SUPABASE_URL=${STAGING_SUPABASE_URL}
         - LLM_API_KEY=${STAGING_LLM_KEY}
   ```

2. **Deploy**:
   ```bash
   docker-compose -f docker-compose.staging.yml up -d
   ```

3. **Run smoke tests**:
   ```bash
   ./scripts/test-endpoints.sh https://staging.example.com
   ```

### 9. Gradual Rollout

#### Option A: Feature Flag

Add feature flag in frontend:

```typescript
const USE_NEW_BACKEND = import.meta.env.VITE_USE_NEW_BACKEND === 'true';

const apiClient = USE_NEW_BACKEND
  ? new FastAPIClient()
  : new LovableClient();
```

#### Option B: A/B Testing

Route percentage of traffic to new backend:

```nginx
# nginx.conf
upstream backend {
  server lovable-backend:8000 weight=90;
  server fastapi-backend:8000 weight=10;
}
```

#### Option C: User-based Rollout

Enable new backend for specific users:

```typescript
const useNewBackend = userSettings.beta_features?.includes('fastapi_backend');
```

### 10. Monitor and Validate

#### Key Metrics to Monitor

- **Response times**: Compare Lovable vs FastAPI
- **Error rates**: Track 4xx and 5xx errors
- **Success rates**: Analysis completion rates
- **User feedback**: Collect feedback from beta users

#### Monitoring Setup

```bash
# View logs
docker-compose logs -f api-gateway | grep ERROR

# Check job success rate
psql $DATABASE_URL -c "
  SELECT
    status,
    COUNT(*)
  FROM jobs
  WHERE created_at > NOW() - INTERVAL '24 hours'
  GROUP BY status;
"
```

### 11. Rollback Plan

If issues are detected:

1. **Immediate rollback**:
   ```bash
   # Switch frontend back to Lovable
   export VITE_API_URL=https://lovable-backend.example.com
   npm run build && npm run deploy
   ```

2. **Database rollback** (if migrations were run):
   ```bash
   # Restore from backup
   pg_restore -d your_database backup.dump
   ```

3. **Communication**:
   - Notify users of temporary rollback
   - Document issues encountered
   - Plan remediation

### 12. Full Cutover

When ready for complete migration:

1. **Final validation**:
   - [ ] All tests passing
   - [ ] Performance acceptable
   - [ ] No critical bugs
   - [ ] User feedback positive

2. **Update production**:
   ```bash
   # Update frontend to only use FastAPI
   export VITE_API_URL=https://api.example.com
   npm run build && npm run deploy
   ```

3. **Decommission Lovable backend**:
   - Keep running for 1 week (safety)
   - Monitor for unexpected traffic
   - Archive code and data
   - Final shutdown

## Troubleshooting

### Frontend can't connect to new backend

1. Check CORS configuration in backend
2. Verify API URL in frontend config
3. Check network connectivity
4. Review browser console for errors

### Analysis results differ

1. Verify same package versions
2. Check RNG seed consistency
3. Review parameter mapping
4. Compare debug logs

### Performance degradation

1. Check Python service resources
2. Review database query performance
3. Monitor LLM API latency
4. Consider adding caching

## Post-Migration Checklist

- [ ] All frontend features working
- [ ] Database properly configured
- [ ] Monitoring and alerts set up
- [ ] Documentation updated
- [ ] Team trained on new system
- [ ] Lovable backend archived
- [ ] Performance baselines established
- [ ] Backup procedures tested

## Support

For migration issues:
1. Check logs: `docker-compose logs -f`
2. Review troubleshooting section in README.md
3. Create issue with migration details
4. Contact team for assistance

## Success Criteria

Migration is successful when:
- ✅ All frontend features work with new backend
- ✅ Analysis results match Lovable (where applicable)
- ✅ Performance meets or exceeds Lovable
- ✅ No data loss during migration
- ✅ Users experience seamless transition
- ✅ Monitoring shows stable operation
