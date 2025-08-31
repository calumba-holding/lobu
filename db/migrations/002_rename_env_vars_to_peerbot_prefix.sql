-- migrate:up
-- Migration to rename environment variables to use PEERBOT_ prefix
-- This updates existing user_configs to use the new naming convention

-- Update environment variables in user_configs table
-- This handles the migration properly without syntax errors
UPDATE user_configs
SET 
    environment_variables = 
        (COALESCE(environment_variables, ''::hstore) 
        - 'DATABASE_URL'::text - 'DB_USERNAME'::text - 'DB_PASSWORD'::text)
        || CASE 
            WHEN environment_variables ? 'DATABASE_URL' 
            THEN hstore('PEERBOT_DATABASE_URL', environment_variables->'DATABASE_URL')
            ELSE ''::hstore
        END
        || CASE 
            WHEN environment_variables ? 'DB_USERNAME' 
            THEN hstore('PEERBOT_DATABASE_USERNAME', environment_variables->'DB_USERNAME')
            ELSE ''::hstore
        END
        || CASE 
            WHEN environment_variables ? 'DB_PASSWORD' 
            THEN hstore('PEERBOT_DATABASE_PASSWORD', environment_variables->'DB_PASSWORD')
            ELSE ''::hstore
        END,
    updated_at = NOW()
WHERE 
    environment_variables IS NOT NULL
    AND (
        environment_variables ? 'DATABASE_URL' 
        OR environment_variables ? 'DB_USERNAME' 
        OR environment_variables ? 'DB_PASSWORD'
    )
    AND NOT (
        environment_variables ? 'PEERBOT_DATABASE_URL' 
        AND environment_variables ? 'PEERBOT_DATABASE_USERNAME' 
        AND environment_variables ? 'PEERBOT_DATABASE_PASSWORD'
    );

-- migrate:down
-- Rollback script to revert environment variables to old naming convention

-- Revert environment variables in user_configs table back to old names
UPDATE user_configs
SET 
    environment_variables = 
        (COALESCE(environment_variables, ''::hstore)
        - 'PEERBOT_DATABASE_URL'::text - 'PEERBOT_DATABASE_USERNAME'::text - 'PEERBOT_DATABASE_PASSWORD'::text)
        || CASE 
            WHEN environment_variables ? 'PEERBOT_DATABASE_URL' 
            THEN hstore('DATABASE_URL', environment_variables->'PEERBOT_DATABASE_URL')
            ELSE ''::hstore
        END
        || CASE 
            WHEN environment_variables ? 'PEERBOT_DATABASE_USERNAME' 
            THEN hstore('DB_USERNAME', environment_variables->'PEERBOT_DATABASE_USERNAME')
            ELSE ''::hstore
        END
        || CASE 
            WHEN environment_variables ? 'PEERBOT_DATABASE_PASSWORD' 
            THEN hstore('DB_PASSWORD', environment_variables->'PEERBOT_DATABASE_PASSWORD')
            ELSE ''::hstore
        END,
    updated_at = NOW()
WHERE 
    environment_variables IS NOT NULL
    AND (
        environment_variables ? 'PEERBOT_DATABASE_URL' 
        OR environment_variables ? 'PEERBOT_DATABASE_USERNAME' 
        OR environment_variables ? 'PEERBOT_DATABASE_PASSWORD'
    );