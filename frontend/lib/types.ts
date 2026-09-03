export type FinalStatus = 'AUTO_RESOLVE' | 'NEEDS_REVIEW' | 'EXCEPTION';
export type ReconLevel = 'L1_ORDER' | 'L2_SETTLEMENT';

export interface BatchSummary {
  batch_id: string;
  status: string;
  name?: string;
  created_at?: string;
  completed_at?: string;
  processing_time_ms: number;
  total_records: number;
  matched_count: number;
  auto_resolved_count: number;
  ai_investigated_count: number;
  exception_count: number;
  needs_review_count: number;
  match_rate: number;
  auto_resolve_rate: number;
  unresolved_amount: number;
  throughput_records_per_sec: number;
  l1_total: number;
  l1_matched: number;
  l1_exceptions: number;
  l2_total: number;
  l2_matched: number;
  l2_exceptions: number;
  l1_accuracy?: number;
  l1_f1?: number;
  l2_accuracy?: number;
  l2_f1?: number;
}

export interface ReconRecordListItem {
  id: string;
  batch_id: string;
  recon_level: ReconLevel;
  work_key: string;
  match_method?: string;
  match_score?: number;
  internal_gross?: number;
  processor_gross?: number;
  gross_diff: number;
  fee_amount: number;
  expected_net_total?: number;
  credited_amount?: number;
  settlement_diff: number;
  currency: string;
  ml_prediction?: string;
  ml_confidence?: number;
  final_status: FinalStatus;
  final_root_cause?: string;
  ai_investigated: boolean;
  ground_truth_outcome?: string;
}

export interface ReconRecordListResponse {
  batch_id: string;
  total: number;
  page: number;
  limit: number;
  records: ReconRecordListItem[];
}

export interface ExceptionRecordListItem {
  id: string;
  batch_id: string;
  recon_level: ReconLevel;
  work_key: string;
  discrepancy_amount: number;
  currency: string;
  predicted_cause: string;
  ml_confidence: number;
  final_status: FinalStatus;
  ai_investigated: boolean;
  ai_explanation?: string;
  recommended_action?: string;
}

export interface ExceptionListResponse {
  batch_id: string;
  total: number;
  page: number;
  limit: number;
  exceptions: ExceptionRecordListItem[];
}

export interface AuditTrailEntry {
  id: string;
  step: string;
  action: string;
  details?: Record<string, any> | string;
  created_at: string;
}

export interface RecordDetail {
  id: string;
  batch_id: string;
  recon_level: ReconLevel;
  work_key: string;
  internal_payment_id?: string;
  processor_transaction_id?: string;
  settlement_batch_id?: string;
  bank_entry_id?: string;
  match_method?: string;
  match_score?: number;
  expected_amount: number;
  settled_amount: number;
  difference: number;
  fee_amount: number;
  refund_amount: number;
  unexplained_amount: number;
  settlement_delay_days?: number;
  currency: string;
  currency_match: boolean;
  is_duplicate: boolean;
  ml_prediction?: string;
  ml_confidence?: number;
  ml_feature_vector?: Record<string, any>;
  ai_investigated: boolean;
  ai_decision?: string;
  ai_root_cause?: string;
  ai_confidence?: number;
  ai_evidence?: string[];
  ai_explanation?: string;
  ai_recommended_action?: string;
  final_status: FinalStatus;
  final_root_cause?: string;
  policy_reason?: string;
  ground_truth_outcome?: string;
  ground_truth_reason?: string;
  ground_truth_difference?: number;
  ground_truth_explanation?: string;
  audit_trail: AuditTrailEntry[];
}

export interface ModelMetrics {
  model_name: string;
  n_classes: number;
  classes: string[];
  train_size: number;
  test_size: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  avg_confidence: number;
  feature_importance: Record<string, number>;
  confusion_matrix: number[][];
  per_class_report: Record<string, {
    precision: number;
    recall: number;
    'f1-score': number;
    support: number;
  }>;
}

export interface EvaluationMetricsResponse {
  fee_policy: {
    rate: number;
    fixed: number;
  };
  l1_metrics: ModelMetrics;
  l2_metrics: ModelMetrics;
}
