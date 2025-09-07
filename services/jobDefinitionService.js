const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

class JobDefinitionService {
    constructor() {
        this.supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_KEY
        );
    }

    /**
     * Load all enabled job definitions from database
     * @returns {Promise<Array>} Array of job definitions
     */
    async getAllEnabledJobs() {
        try {
            const { data, error } = await this.supabase
                .from('job_definitions')
                .select('*')
                .eq('enabled', true)
                .order('name');

            if (error) {
                throw new Error(`Failed to load job definitions: ${error.message}`);
            }

            logger.debug(`Loaded ${data?.length || 0} enabled job definitions from database`);
            return data || [];
        } catch (error) {
            logger.error('Error loading job definitions:', error);
            throw error;
        }
    }

    /**
     * Get all job definitions (enabled and disabled)
     * @returns {Promise<Array>} Array of all job definitions
     */
    async getAllJobs() {
        try {
            const { data, error } = await this.supabase
                .from('job_definitions')
                .select('*')
                .order('name');

            if (error) {
                throw new Error(`Failed to load all job definitions: ${error.message}`);
            }

            return data || [];
        } catch (error) {
            logger.error('Error loading all job definitions:', error);
            throw error;
        }
    }

    /**
     * Get job definition by name
     * @param {string} jobName - Name of the job
     * @returns {Promise<Object>} Job definition
     */
    async getJobByName(jobName) {
        try {
            const { data, error } = await this.supabase
                .from('job_definitions')
                .select('*')
                .eq('name', jobName)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    throw new Error(`Job definition '${jobName}' not found`);
                }
                throw new Error(`Failed to get job definition: ${error.message}`);
            }

            return data;
        } catch (error) {
            logger.error(`Error loading job definition '${jobName}':`, error);
            throw error;
        }
    }

    /**
     * Update job enabled status
     * @param {string} jobName - Name of the job
     * @param {boolean} enabled - Whether job should be enabled
     * @returns {Promise<void>}
     */
    async updateJobStatus(jobName, enabled) {
        try {
            const { error } = await this.supabase
                .from('job_definitions')
                .update({ 
                    enabled, 
                    updated_at: new Date().toISOString()
                })
                .eq('name', jobName);

            if (error) {
                throw new Error(`Failed to update job status: ${error.message}`);
            }

            logger.info(`Job '${jobName}' ${enabled ? 'enabled' : 'disabled'} successfully`);
        } catch (error) {
            logger.error(`Error updating job status for '${jobName}':`, error);
            throw error;
        }
    }

    /**
     * Update job configuration
     * @param {string} jobName - Name of the job
     * @param {Object} updates - Configuration updates
     * @returns {Promise<void>}
     */
    async updateJobConfig(jobName, updates) {
        try {
            const allowedFields = [
                'description', 'schedule', 'handler_function', 'enabled', 
                'timezone', 'max_retries', 'retry_delay_ms', 'timeout_ms', 'options'
            ];

            // Filter updates to only allowed fields
            const filteredUpdates = Object.keys(updates)
                .filter(key => allowedFields.includes(key))
                .reduce((obj, key) => {
                    obj[key] = updates[key];
                    return obj;
                }, {});

            filteredUpdates.updated_at = new Date().toISOString();

            const { error } = await this.supabase
                .from('job_definitions')
                .update(filteredUpdates)
                .eq('name', jobName);

            if (error) {
                throw new Error(`Failed to update job config: ${error.message}`);
            }

            logger.info(`Job '${jobName}' configuration updated successfully`);
        } catch (error) {
            logger.error(`Error updating job config for '${jobName}':`, error);
            throw error;
        }
    }

    /**
     * Create new job definition
     * @param {Object} jobDefinition - Job definition object
     * @returns {Promise<Object>} Created job definition
     */
    async createJob(jobDefinition) {
        try {
            const requiredFields = ['name', 'schedule', 'handler_function'];
            const missingFields = requiredFields.filter(field => !jobDefinition[field]);
            
            if (missingFields.length > 0) {
                throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
            }

            const { data, error } = await this.supabase
                .from('job_definitions')
                .insert([jobDefinition])
                .select()
                .single();

            if (error) {
                if (error.code === '23505') {
                    throw new Error(`Job with name '${jobDefinition.name}' already exists`);
                }
                throw new Error(`Failed to create job definition: ${error.message}`);
            }

            logger.info(`Job definition '${jobDefinition.name}' created successfully`);
            return data;
        } catch (error) {
            logger.error('Error creating job definition:', error);
            throw error;
        }
    }

    /**
     * Delete job definition
     * @param {string} jobName - Name of the job to delete
     * @returns {Promise<void>}
     */
    async deleteJob(jobName) {
        try {
            const { error } = await this.supabase
                .from('job_definitions')
                .delete()
                .eq('name', jobName);

            if (error) {
                throw new Error(`Failed to delete job definition: ${error.message}`);
            }

            logger.info(`Job definition '${jobName}' deleted successfully`);
        } catch (error) {
            logger.error(`Error deleting job definition '${jobName}':`, error);
            throw error;
        }
    }

    /**
     * Get jobs with their last execution status
     * @returns {Promise<Array>} Array of jobs with execution status
     */
    async getJobsWithStatus() {
        try {
            const { data, error } = await this.supabase
                .from('job_definitions_with_status')
                .select('*')
                .order('name');

            if (error) {
                throw new Error(`Failed to load jobs with status: ${error.message}`);
            }

            return data || [];
        } catch (error) {
            logger.error('Error loading jobs with status:', error);
            throw error;
        }
    }
}

module.exports = new JobDefinitionService();