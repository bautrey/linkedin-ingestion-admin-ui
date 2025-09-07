// Test fixtures for candidate evaluation data
// Covers high, medium, and low-performing candidates with realistic API responses

const highPerformingCandidate = {
    candidate: {
        candidateKey: 'CAN-HIGH-001',
        linkedinUrl: 'https://www.linkedin.com/in/senior-cto-tech',
        fullName: 'Sarah Johnson'
    },
    steps: [
        { name: 'verify', success: true, result: { valid: true }, duration: 1000 },
        { name: 'ingest', success: true, result: { profile_id: 'prof-001' }, duration: 2000 },
        { name: 'check_compatibility', success: true, result: { 
            profile_id: 'prof-001',
            linkedin_url: 'https://www.linkedin.com/in/senior-cto-tech',
            proceed_with_scoring: true,
            recommended_primary_role: 'CTO',
            overall_assessment: 'CIO 0.78 | CTO 0.92 | CISO 0.35. Outstanding technology executive with proven track record in scaling engineering organizations and driving digital transformation. Multiple CTO roles demonstrate consistent success in enterprise environments with strong P&L influence.',
            compatible_roles: [
                { 
                    role: 'CTO', 
                    compatible: true, 
                    confidence: 0.92, 
                    reasoning: 'Extensive experience in technology leadership with P&L responsibility',
                    key_qualifications: [
                        'Multiple CTO roles in enterprise environments',
                        'Led digital transformation initiatives',
                        'Built and scaled technology teams of 200+ engineers',
                        'Experience with cloud architecture and DevOps'
                    ],
                    missing_qualifications: [
                        'No evidence of large-scale public company board exposure'
                    ]
                },
                { 
                    role: 'CIO', 
                    compatible: true, 
                    confidence: 0.78, 
                    reasoning: 'Strong business alignment with enterprise IT experience',
                    key_qualifications: [
                        'Enterprise architecture experience',
                        'Technology strategy development',
                        'Cross-functional leadership experience'
                    ],
                    missing_qualifications: [
                        'Limited ERP/CRM management experience',
                        'No clear vendor relationship management'
                    ]
                },
                { 
                    role: 'CISO', 
                    compatible: false, 
                    confidence: 0.35, 
                    reasoning: 'Limited security governance experience',
                    key_qualifications: [
                        'Technology leadership experience',
                        'Enterprise risk awareness'
                    ],
                    missing_qualifications: [
                        'No evidence of security program leadership',
                        'Lacks compliance and risk management background',
                        'No board-level security reporting'
                    ]
                }
            ],
            model_used: 'gpt-4o',
            ai_response_time: 3.2
        }, duration: 3000 },
        { name: 'score', success: true, result: { score: 94, role: 'CTO' }, duration: 4000 },
        { name: 'update_jira', success: true, result: { jiraUpdated: true }, duration: 1000 }
    ],
    compatibilityStep: {
        success: true,
        result: {
            profile_id: 'prof-001',
            linkedin_url: 'https://www.linkedin.com/in/senior-cto-tech',
            proceed_with_scoring: true,
            recommended_primary_role: 'CTO',
            overall_assessment: 'CIO 0.78 | CTO 0.92 | CISO 0.35. Outstanding technology executive with proven track record in scaling engineering organizations and driving digital transformation. Multiple CTO roles demonstrate consistent success in enterprise environments with strong P&L influence.',
            compatible_roles: [
                { 
                    role: 'CTO', 
                    compatible: true, 
                    confidence: 0.92, 
                    reasoning: 'Extensive experience in technology leadership with P&L responsibility',
                    key_qualifications: [
                        'Multiple CTO roles in enterprise environments',
                        'Led digital transformation initiatives',
                        'Built and scaled technology teams of 200+ engineers',
                        'Experience with cloud architecture and DevOps'
                    ],
                    missing_qualifications: [
                        'No evidence of large-scale public company board exposure'
                    ]
                },
                { 
                    role: 'CIO', 
                    compatible: true, 
                    confidence: 0.78, 
                    reasoning: 'Strong business alignment with enterprise IT experience',
                    key_qualifications: [
                        'Enterprise architecture experience',
                        'Technology strategy development',
                        'Cross-functional leadership experience'
                    ],
                    missing_qualifications: [
                        'Limited ERP/CRM management experience',
                        'No clear vendor relationship management'
                    ]
                },
                { 
                    role: 'CISO', 
                    compatible: false, 
                    confidence: 0.35, 
                    reasoning: 'Limited security governance experience',
                    key_qualifications: [
                        'Technology leadership experience',
                        'Enterprise risk awareness'
                    ],
                    missing_qualifications: [
                        'No evidence of security program leadership',
                        'Lacks compliance and risk management background',
                        'No board-level security reporting'
                    ]
                }
            ],
            model_used: 'gpt-4o',
            ai_response_time: 3.2
        }
    },
    scoreStep: {
        success: true,
        result: { 
            score: 94, 
            role: 'CTO',
            fit_verdict: 'Strong Fit',
            rationale: 'Outstanding technology executive with proven track record in scaling engineering organizations and driving digital transformation. Multiple CTO roles demonstrate consistent success in enterprise environments.',
            gatekeeper_result: 'Pass'
        }
    },
    fitStatus: 'Scored (See Score and Comments)',
    fitScore: 94,
    profileId: 'prof-001'
};

const mediumPerformingCandidate = {
    candidate: {
        candidateKey: 'CAN-MED-002',
        linkedinUrl: 'https://www.linkedin.com/in/mid-level-tech-manager',
        fullName: 'Michael Chen'
    },
    steps: [
        { name: 'verify', success: true, result: { valid: true }, duration: 1000 },
        { name: 'ingest', success: true, result: { profile_id: 'prof-002' }, duration: 2000 },
        { name: 'check_compatibility', success: true, result: { 
            compatibility: {
                recommended_primary_role: 'CIO',
                compatible_roles: [
                    { 
                        role: 'CTO', 
                        compatible: false, 
                        confidence: 0.45, 
                        reasoning: 'Limited hands-on technical leadership experience',
                        key_qualifications: [
                            'Technology management experience',
                            'Some team leadership background'
                        ],
                        missing_qualifications: [
                            'No evidence of large-scale architecture decisions',
                            'Limited product development experience',
                            'No startup or innovation leadership'
                        ]
                    },
                    { 
                        role: 'CIO', 
                        compatible: true, 
                        confidence: 0.72, 
                        reasoning: 'Good fit for enterprise IT leadership with strong operational focus',
                        key_qualifications: [
                            'Enterprise IT management experience',
                            'Vendor relationship management',
                            'IT operations and infrastructure background',
                            'Business process optimization experience'
                        ],
                        missing_qualifications: [
                            'Limited board-level presentation experience',
                            'No major digital transformation leadership'
                        ]
                    },
                    { 
                        role: 'CISO', 
                        compatible: false, 
                        confidence: 0.25, 
                        reasoning: 'Insufficient security specialization',
                        key_qualifications: [
                            'General IT management experience'
                        ],
                        missing_qualifications: [
                            'No security program experience',
                            'Lacks compliance background',
                            'No incident response leadership'
                        ]
                    }
                ],
                overall_assessment: 'Solid IT executive with strong operational background. Best fit for CIO role in organizations needing infrastructure modernization and process optimization.',
                model_used: 'gpt-4o',
                ai_response_time: 2.8,
                proceed_with_scoring: true
            }
        }, duration: 3000 },
        { name: 'score', success: true, result: { score: 73, role: 'CIO' }, duration: 4000 },
        { name: 'update_jira', success: true, result: { jiraUpdated: true }, duration: 1000 }
    ],
    compatibilityStep: {
        success: true,
        result: {
            profile_id: 'prof-001',
            linkedin_url: 'https://www.linkedin.com/in/senior-cto-tech',
            proceed_with_scoring: true,
            recommended_primary_role: 'CTO',
            overall_assessment: 'CIO 0.78 | CTO 0.92 | CISO 0.35. Outstanding technology executive with proven track record in scaling engineering organizations and driving digital transformation. Multiple CTO roles demonstrate consistent success in enterprise environments with strong P&L influence.',
            compatible_roles: [
                { 
                    role: 'CTO', 
                    compatible: true, 
                    confidence: 0.92, 
                    reasoning: 'Extensive experience in technology leadership with P&L responsibility',
                    key_qualifications: [
                        'Multiple CTO roles in enterprise environments',
                        'Led digital transformation initiatives',
                        'Built and scaled technology teams of 200+ engineers',
                        'Experience with cloud architecture and DevOps'
                    ],
                    missing_qualifications: [
                        'No evidence of large-scale public company board exposure'
                    ]
                },
                { 
                    role: 'CIO', 
                    compatible: true, 
                    confidence: 0.78, 
                    reasoning: 'Strong business alignment with enterprise IT experience',
                    key_qualifications: [
                        'Enterprise architecture experience',
                        'Technology strategy development',
                        'Cross-functional leadership experience'
                    ],
                    missing_qualifications: [
                        'Limited ERP/CRM management experience',
                        'No clear vendor relationship management'
                    ]
                },
                { 
                    role: 'CISO', 
                    compatible: false, 
                    confidence: 0.35, 
                    reasoning: 'Limited security governance experience',
                    key_qualifications: [
                        'Technology leadership experience',
                        'Enterprise risk awareness'
                    ],
                    missing_qualifications: [
                        'No evidence of security program leadership',
                        'Lacks compliance and risk management background',
                        'No board-level security reporting'
                    ]
                }
            ],
            model_used: 'gpt-4o',
            ai_response_time: 3.2
        }
    },
    scoreStep: {
        success: true,
        result: { 
            score: 73, 
            role: 'CIO',
            fit_verdict: 'Good Fit',
            rationale: 'Experienced IT executive with strong potential for CIO role. Good business alignment and operational focus, with some development areas in digital transformation leadership.',
            gatekeeper_result: 'Pass'
        }
    },
    fitStatus: 'Scored (See Score and Comments)',
    fitScore: 73,
    profileId: 'prof-002'
};

const lowPerformingCandidate = {
    candidate: {
        candidateKey: 'CAN-LOW-003',
        linkedinUrl: 'https://www.linkedin.com/in/junior-developer',
        fullName: 'Alex Rodriguez'
    },
    steps: [
        { name: 'verify', success: true, result: { valid: true }, duration: 1000 },
        { name: 'ingest', success: true, result: { profile_id: 'prof-003' }, duration: 2000 },
        { name: 'check_compatibility', success: true, result: { 
            compatibility: {
                recommended_primary_role: null,
                compatible_roles: [
                    { 
                        role: 'CTO', 
                        compatible: false, 
                        confidence: 0.15, 
                        reasoning: 'Insufficient senior technology leadership experience',
                        key_qualifications: [
                            'Software development experience'
                        ],
                        missing_qualifications: [
                            'No team leadership experience',
                            'Lacks strategic technology planning',
                            'No P&L or budget responsibility',
                            'Limited enterprise architecture exposure'
                        ]
                    },
                    { 
                        role: 'CIO', 
                        compatible: false, 
                        confidence: 0.20, 
                        reasoning: 'Limited business and enterprise IT experience',
                        key_qualifications: [
                            'Basic technology background'
                        ],
                        missing_qualifications: [
                            'No enterprise IT management',
                            'Lacks vendor management experience',
                            'No business process optimization background',
                            'Limited stakeholder management experience'
                        ]
                    },
                    { 
                        role: 'CISO', 
                        compatible: false, 
                        confidence: 0.12, 
                        reasoning: 'No security leadership or governance experience',
                        key_qualifications: [],
                        missing_qualifications: [
                            'No security program experience',
                            'Lacks compliance and risk management',
                            'No incident response or governance background',
                            'Limited enterprise security exposure'
                        ]
                    }
                ],
                overall_assessment: 'Early career professional with solid technical skills but lacks the senior leadership experience required for C-level executive roles. Would benefit from additional years in management positions.',
                model_used: 'gpt-4o',
                ai_response_time: 2.1,
                proceed_with_scoring: false
            }
        }, duration: 3000 }
    ],
    compatibilityStep: {
        success: true,
        result: {
            profile_id: 'prof-001',
            linkedin_url: 'https://www.linkedin.com/in/senior-cto-tech',
            proceed_with_scoring: true,
            recommended_primary_role: 'CTO',
            overall_assessment: 'CIO 0.78 | CTO 0.92 | CISO 0.35. Outstanding technology executive with proven track record in scaling engineering organizations and driving digital transformation. Multiple CTO roles demonstrate consistent success in enterprise environments with strong P&L influence.',
            compatible_roles: [
                { 
                    role: 'CTO', 
                    compatible: true, 
                    confidence: 0.92, 
                    reasoning: 'Extensive experience in technology leadership with P&L responsibility',
                    key_qualifications: [
                        'Multiple CTO roles in enterprise environments',
                        'Led digital transformation initiatives',
                        'Built and scaled technology teams of 200+ engineers',
                        'Experience with cloud architecture and DevOps'
                    ],
                    missing_qualifications: [
                        'No evidence of large-scale public company board exposure'
                    ]
                },
                { 
                    role: 'CIO', 
                    compatible: true, 
                    confidence: 0.78, 
                    reasoning: 'Strong business alignment with enterprise IT experience',
                    key_qualifications: [
                        'Enterprise architecture experience',
                        'Technology strategy development',
                        'Cross-functional leadership experience'
                    ],
                    missing_qualifications: [
                        'Limited ERP/CRM management experience',
                        'No clear vendor relationship management'
                    ]
                },
                { 
                    role: 'CISO', 
                    compatible: false, 
                    confidence: 0.35, 
                    reasoning: 'Limited security governance experience',
                    key_qualifications: [
                        'Technology leadership experience',
                        'Enterprise risk awareness'
                    ],
                    missing_qualifications: [
                        'No evidence of security program leadership',
                        'Lacks compliance and risk management background',
                        'No board-level security reporting'
                    ]
                }
            ],
            model_used: 'gpt-4o',
            ai_response_time: 3.2
        }
    },
    scoreStep: null,
    fitStatus: 'No Fit (0 Score)',
    fitScore: 0,
    profileId: 'prof-003'
};

const partialProcessingCandidate = {
    candidate: {
        candidateKey: 'CAN-PARTIAL-004',
        linkedinUrl: 'https://www.linkedin.com/in/experienced-manager',
        fullName: 'Jennifer Park'
    },
    steps: [
        { name: 'verify', success: true, result: { valid: true }, duration: 1000 },
        { name: 'ingest', success: true, result: { profile_id: 'prof-004' }, duration: 2000 },
        { name: 'check_compatibility', success: true, result: { 
            compatibility: {
                recommended_primary_role: 'CIO',
                compatible_roles: [
                    { 
                        role: 'CIO', 
                        compatible: true, 
                        confidence: 0.68, 
                        reasoning: 'Strong enterprise IT background with good leadership experience',
                        key_qualifications: [
                            'Enterprise IT management',
                            'Digital transformation experience',
                            'Strong stakeholder management'
                        ],
                        missing_qualifications: [
                            'Limited board-level experience'
                        ]
                    }
                ],
                overall_assessment: 'Experienced IT executive with strong potential for CIO role',
                model_used: 'gpt-4o',
                ai_response_time: 2.5,
                proceed_with_scoring: true
            }
        }, duration: 3000 },
        { name: 'score', success: false, error: 'Scoring service timeout', duration: 4000 },
        { name: 'update_jira', success: true, result: { jiraUpdated: true }, duration: 1000 }
    ],
    compatibilityStep: {
        success: true,
        result: {
            profile_id: 'prof-001',
            linkedin_url: 'https://www.linkedin.com/in/senior-cto-tech',
            proceed_with_scoring: true,
            recommended_primary_role: 'CTO',
            overall_assessment: 'CIO 0.78 | CTO 0.92 | CISO 0.35. Outstanding technology executive with proven track record in scaling engineering organizations and driving digital transformation. Multiple CTO roles demonstrate consistent success in enterprise environments with strong P&L influence.',
            compatible_roles: [
                { 
                    role: 'CTO', 
                    compatible: true, 
                    confidence: 0.92, 
                    reasoning: 'Extensive experience in technology leadership with P&L responsibility',
                    key_qualifications: [
                        'Multiple CTO roles in enterprise environments',
                        'Led digital transformation initiatives',
                        'Built and scaled technology teams of 200+ engineers',
                        'Experience with cloud architecture and DevOps'
                    ],
                    missing_qualifications: [
                        'No evidence of large-scale public company board exposure'
                    ]
                },
                { 
                    role: 'CIO', 
                    compatible: true, 
                    confidence: 0.78, 
                    reasoning: 'Strong business alignment with enterprise IT experience',
                    key_qualifications: [
                        'Enterprise architecture experience',
                        'Technology strategy development',
                        'Cross-functional leadership experience'
                    ],
                    missing_qualifications: [
                        'Limited ERP/CRM management experience',
                        'No clear vendor relationship management'
                    ]
                },
                { 
                    role: 'CISO', 
                    compatible: false, 
                    confidence: 0.35, 
                    reasoning: 'Limited security governance experience',
                    key_qualifications: [
                        'Technology leadership experience',
                        'Enterprise risk awareness'
                    ],
                    missing_qualifications: [
                        'No evidence of security program leadership',
                        'Lacks compliance and risk management background',
                        'No board-level security reporting'
                    ]
                }
            ],
            model_used: 'gpt-4o',
            ai_response_time: 3.2
        }
    },
    scoreStep: {
        success: false,
        error: 'Scoring service timeout'
    },
    fitStatus: 'Unscored',
    fitScore: 0,
    profileId: 'prof-004'
};

const failedVerificationCandidate = {
    candidate: {
        candidateKey: 'CAN-FAILED-005',
        linkedinUrl: 'https://www.linkedin.com/in/private-profile',
        fullName: 'David Kim'
    },
    steps: [
        { name: 'verify', success: false, error: 'Profile not accessible', duration: 1000 }
    ],
    compatibilityStep: null,
    scoreStep: null,
    fitStatus: 'Invalid LinkedIn URL',
    fitScore: 0,
    profileId: null,
    errorMessage: 'Profile not accessible'
};

// Edge case: Minimal data
const minimalDataCandidate = {
    candidate: {
        candidateKey: 'CAN-MIN-006',
        linkedinUrl: 'https://www.linkedin.com/in/basic-profile',
        fullName: 'Maria Garcia'
    },
    steps: [
        { name: 'verify', success: true, result: { valid: true }, duration: 1000 },
        { name: 'ingest', success: true, result: { profile_id: 'prof-006' }, duration: 2000 },
        { name: 'check_compatibility', success: true, result: { 
            compatibility: {
                recommended_primary_role: 'CTO',
                compatible_roles: [
                    { 
                        role: 'CTO', 
                        compatible: true, 
                        confidence: 0.55, 
                        reasoning: 'Limited data but shows potential',
                        key_qualifications: ['Technical background'],
                        missing_qualifications: ['Needs more experience']
                    }
                ],
                overall_assessment: 'Limited profile data available',
                model_used: 'gpt-4o',
                ai_response_time: 1.2,
                proceed_with_scoring: true
            }
        }, duration: 2000 },
        { name: 'score', success: true, result: { score: 55, role: 'CTO' }, duration: 3000 }
    ],
    compatibilityStep: {
        success: true,
        result: {
            profile_id: 'prof-001',
            linkedin_url: 'https://www.linkedin.com/in/senior-cto-tech',
            proceed_with_scoring: true,
            recommended_primary_role: 'CTO',
            overall_assessment: 'CIO 0.78 | CTO 0.92 | CISO 0.35. Outstanding technology executive with proven track record in scaling engineering organizations and driving digital transformation. Multiple CTO roles demonstrate consistent success in enterprise environments with strong P&L influence.',
            compatible_roles: [
                { 
                    role: 'CTO', 
                    compatible: true, 
                    confidence: 0.92, 
                    reasoning: 'Extensive experience in technology leadership with P&L responsibility',
                    key_qualifications: [
                        'Multiple CTO roles in enterprise environments',
                        'Led digital transformation initiatives',
                        'Built and scaled technology teams of 200+ engineers',
                        'Experience with cloud architecture and DevOps'
                    ],
                    missing_qualifications: [
                        'No evidence of large-scale public company board exposure'
                    ]
                },
                { 
                    role: 'CIO', 
                    compatible: true, 
                    confidence: 0.78, 
                    reasoning: 'Strong business alignment with enterprise IT experience',
                    key_qualifications: [
                        'Enterprise architecture experience',
                        'Technology strategy development',
                        'Cross-functional leadership experience'
                    ],
                    missing_qualifications: [
                        'Limited ERP/CRM management experience',
                        'No clear vendor relationship management'
                    ]
                },
                { 
                    role: 'CISO', 
                    compatible: false, 
                    confidence: 0.35, 
                    reasoning: 'Limited security governance experience',
                    key_qualifications: [
                        'Technology leadership experience',
                        'Enterprise risk awareness'
                    ],
                    missing_qualifications: [
                        'No evidence of security program leadership',
                        'Lacks compliance and risk management background',
                        'No board-level security reporting'
                    ]
                }
            ],
            model_used: 'gpt-4o',
            ai_response_time: 3.2
        }
    },
    scoreStep: {
        success: true,
        result: { score: 55, role: 'CTO' }
    },
    fitStatus: 'Scored (See Score and Comments)',
    fitScore: 55,
    profileId: 'prof-006'
};

module.exports = {
    highPerformingCandidate,
    mediumPerformingCandidate,
    lowPerformingCandidate,
    partialProcessingCandidate,
    failedVerificationCandidate,
    minimalDataCandidate
};