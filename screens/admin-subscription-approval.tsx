import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useSubscriptionApproval } from '@/lib/subscription-approval-context';
import { useAdmin } from '@/lib/admin-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

type TabType = 'pending' | 'approved' | 'activated' | 'rejected';

export default function AdminSubscriptionApprovalScreen() {
  const router = useRouter();
  const { adminUser } = useAdmin();
  const {
    pendingRequests,
    approveRequest,
    rejectRequest,
    activateAccount,
    getRequestsByStatus,
  } = useSubscriptionApproval();

  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [approvalNotes, setApprovalNotes] = useState('');

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    setRefreshing(false);
  };

  const handleApprove = async () => {
    if (!selectedRequest || !adminUser) return;

    try {
      approveRequest(
        selectedRequest.id,
        adminUser.id || 'admin',
        adminUser.fullName || 'Admin',
        adminUser.role || 'superadmin',
        approvalNotes
      );

      Alert.alert('Success', 'Subscription request approved successfully');
      setShowApprovalModal(false);
      setApprovalNotes('');
      setSelectedRequest(null);
    } catch (error) {
      Alert.alert('Error', 'Failed to approve request');
    }
  };

  const handleReject = async () => {
    if (!selectedRequest || !adminUser || !rejectionReason.trim()) {
      Alert.alert('Error', 'Please provide a rejection reason');
      return;
    }

    try {
      rejectRequest(
        selectedRequest.id,
        adminUser.id || 'admin',
        adminUser.fullName || 'Admin',
        rejectionReason,
        ''
      );

      Alert.alert('Success', 'Subscription request rejected successfully');
      setShowRejectionModal(false);
      setRejectionReason('');
      setSelectedRequest(null);
    } catch (error) {
      Alert.alert('Error', 'Failed to reject request');
    }
  };

  const handleActivate = async () => {
    if (!selectedRequest || !adminUser) return;

    try {
      activateAccount(
        selectedRequest.id,
        adminUser.id || 'admin',
        adminUser.fullName || 'Admin'
      );

      Alert.alert('Success', 'User account activated successfully');
      setSelectedRequest(null);
    } catch (error) {
      Alert.alert('Error', 'Failed to activate account');
    }
  };

  const requests = getRequestsByStatus(activeTab);
  const stats = {
    pending: getRequestsByStatus('pending').length,
    approved: getRequestsByStatus('approved').length,
    rejected: getRequestsByStatus('rejected').length,
    activated: getRequestsByStatus('activated').length,
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#F59E0B';
      case 'approved':
        return '#22C55E';
      case 'rejected':
        return '#EF4444';
      case 'activated':
        return '#3B82F6';
      default:
        return '#6B7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return 'schedule';
      case 'approved':
        return 'check-circle';
      case 'rejected':
        return 'cancel';
      case 'activated':
        return 'verified';
      default:
        return 'help';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'residential':
        return 'Residential Customer';
      case 'commercial':
        return 'Commercial Customer';
      case 'collector':
        return 'Garbage Collector';
      case 'recycler':
        return 'Recycling Company';
      default:
        return role;
    }
  };

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View className="px-6 pt-4 pb-6 bg-primary">
          <View className="flex-row items-center justify-between mb-4">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-white/20 items-center justify-center"
            >
              <MaterialIcons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text className="text-white text-lg font-bold">Subscription Approvals</Text>
            <View className="w-10 h-10 rounded-full bg-white/20 items-center justify-center">
              <MaterialIcons name="check-circle" size={24} color="#fff" />
            </View>
          </View>

          {/* Stats */}
          <View className="flex-row justify-between gap-2">
            <View className="flex-1 bg-white/20 rounded-lg p-2">
              <Text className="text-white/80 text-xs">Pending</Text>
              <Text className="text-white text-lg font-bold">{stats.pending}</Text>
            </View>
            <View className="flex-1 bg-white/20 rounded-lg p-2">
              <Text className="text-white/80 text-xs">Approved</Text>
              <Text className="text-white text-lg font-bold">{stats.approved}</Text>
            </View>
            <View className="flex-1 bg-white/20 rounded-lg p-2">
              <Text className="text-white/80 text-xs">Activated</Text>
              <Text className="text-white text-lg font-bold">{stats.activated}</Text>
            </View>
            <View className="flex-1 bg-white/20 rounded-lg p-2">
              <Text className="text-white/80 text-xs">Rejected</Text>
              <Text className="text-white text-lg font-bold">{stats.rejected}</Text>
            </View>
          </View>
        </View>

        {/* Tabs */}
        <View className="flex-row bg-surface border-b border-border">
          {(['pending', 'approved', 'activated', 'rejected'] as TabType[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              className={`flex-1 py-3 items-center ${
                activeTab === tab ? 'border-b-2 border-primary' : ''
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  activeTab === tab ? 'text-primary' : 'text-muted'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Requests List */}
        <View className="px-6 pt-4 pb-4">
          {requests.length === 0 ? (
            <View className="items-center justify-center py-12">
              <MaterialIcons name="inbox" size={48} color="#9CA3AF" />
              <Text className="text-muted text-center mt-2">
                No {activeTab} requests
              </Text>
            </View>
          ) : (
            <View className="gap-3">
              {requests.map((request) => (
                <TouchableOpacity
                  key={request.id}
                  onPress={() => setSelectedRequest(request)}
                  className="bg-surface rounded-xl p-4 border border-border"
                >
                  <View className="flex-row items-start justify-between mb-3">
                    <View className="flex-1">
                      <Text className="text-foreground font-semibold text-base">
                        {request.userName}
                      </Text>
                      <Text className="text-muted text-sm mt-1">
                        {getRoleLabel(request.userRole)}
                      </Text>
                    </View>
                    <View
                      className="px-3 py-1 rounded-full flex-row items-center gap-1"
                      style={{ backgroundColor: getStatusColor(request.status) + '20' }}
                    >
                      <MaterialIcons
                        name={getStatusIcon(request.status)}
                        size={14}
                        color={getStatusColor(request.status)}
                      />
                      <Text
                        className="text-xs font-semibold"
                        style={{ color: getStatusColor(request.status) }}
                      >
                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                      </Text>
                    </View>
                  </View>

                  <View className="gap-2 mb-3">
                    <View className="flex-row items-center gap-2">
                      <MaterialIcons name="phone" size={14} color="#6B7280" />
                      <Text className="text-muted text-sm">{request.userPhone}</Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <MaterialIcons name="card-membership" size={14} color="#6B7280" />
                      <Text className="text-muted text-sm">
                        {request.subscriptionPlan} - K{request.planPrice}
                      </Text>
                    </View>
                    {request.affiliationFee && (
                      <View className="flex-row items-center gap-2">
                        <MaterialIcons name="attach-money" size={14} color="#6B7280" />
                        <Text className="text-muted text-sm">
                          Affiliation Fee: K{request.affiliationFee}
                        </Text>
                      </View>
                    )}
                    <View className="flex-row items-center gap-2">
                      <MaterialIcons name="calendar-today" size={14} color="#6B7280" />
                      <Text className="text-muted text-sm">
                        {new Date(request.requestDate).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>

                    {request.paymentMethod && (
                    <View className="bg-primary/10 rounded-lg p-2 mb-3">
                      <Text className="text-primary text-xs font-semibold">
                        Payment: {request.paymentMethod}
                      </Text>
                      {request.paymentReference && (
                        <Text className="text-primary/80 text-xs mt-1">
                          Ref: {request.paymentReference}
                        </Text>
                      )}
                      {request.transactionId && (
                        <Text className="text-primary/80 text-xs mt-1">
                          Txn ID: {request.transactionId}
                        </Text>
                      )}
                      {request.amountPaid !== undefined && (
                        <Text className="text-primary/80 text-xs mt-1">
                          Amount Paid: K{request.amountPaid}
                        </Text>
                      )}
                    </View>
                  )}

                  {activeTab === 'pending' && (
                    <View className="flex-row gap-2">
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedRequest(request);
                          setShowApprovalModal(true);
                        }}
                        className="flex-1 bg-success rounded-lg py-2 items-center"
                      >
                        <Text className="text-white font-semibold text-sm">Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedRequest(request);
                          setShowRejectionModal(true);
                        }}
                        className="flex-1 bg-error rounded-lg py-2 items-center"
                      >
                        <Text className="text-white font-semibold text-sm">Reject</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {request.status === 'approved' && (
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedRequest(request);
                        Alert.alert(
                          'Activate Account',
                          'Activate this user account now?',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Activate',
                              onPress: handleActivate,
                              style: 'default',
                            },
                          ]
                        );
                      }}
                      className="bg-primary rounded-lg py-2 items-center"
                    >
                      <Text className="text-white font-semibold text-sm">Activate Account</Text>
                    </TouchableOpacity>
                  )}

                  {request.rejectionReason && (
                    <View className="bg-error/10 rounded-lg p-2 mt-3">
                      <Text className="text-error text-xs font-semibold mb-1">
                        Rejection Reason:
                      </Text>
                      <Text className="text-error/80 text-xs">{request.rejectionReason}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Approval Modal */}
      <Modal
        visible={showApprovalModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowApprovalModal(false)}
      >
        <View className="flex-1 bg-black/50 items-center justify-end">
          <View className="w-full bg-background rounded-t-3xl p-6 pb-12">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-foreground text-lg font-bold">Approve Request</Text>
              <TouchableOpacity onPress={() => setShowApprovalModal(false)}>
                <MaterialIcons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {selectedRequest && (
              <View className="gap-4">
                <View className="bg-surface rounded-lg p-4 border border-border">
                  <Text className="text-foreground font-semibold mb-2">
                    {selectedRequest.userName}
                  </Text>
                  <Text className="text-muted text-sm">
                    {getRoleLabel(selectedRequest.userRole)}
                  </Text>
                  <Text className="text-muted text-sm mt-2">
                    Plan: {selectedRequest.subscriptionPlan} - K{selectedRequest.planPrice}
                  </Text>
                </View>

                <View>
                  <Text className="text-foreground font-semibold mb-2">
                    Approval Notes (Optional)
                  </Text>
                  <TextInput
                    value={approvalNotes}
                    onChangeText={setApprovalNotes}
                    placeholder="Add notes about this approval..."
                    placeholderTextColor="#9CA3AF"
                    multiline
                    numberOfLines={4}
                    className="bg-surface border border-border rounded-lg p-3 text-foreground"
                    style={{ textAlignVertical: 'top' }}
                  />
                </View>

                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={() => setShowApprovalModal(false)}
                    className="flex-1 bg-surface border border-border rounded-lg py-3 items-center"
                  >
                    <Text className="text-foreground font-semibold">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleApprove}
                    className="flex-1 bg-success rounded-lg py-3 items-center"
                  >
                    <Text className="text-white font-semibold">Approve</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Rejection Modal */}
      <Modal
        visible={showRejectionModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRejectionModal(false)}
      >
        <View className="flex-1 bg-black/50 items-center justify-end">
          <View className="w-full bg-background rounded-t-3xl p-6 pb-12">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-foreground text-lg font-bold">Reject Request</Text>
              <TouchableOpacity onPress={() => setShowRejectionModal(false)}>
                <MaterialIcons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {selectedRequest && (
              <View className="gap-4">
                <View className="bg-surface rounded-lg p-4 border border-border">
                  <Text className="text-foreground font-semibold mb-2">
                    {selectedRequest.userName}
                  </Text>
                  <Text className="text-muted text-sm">
                    {getRoleLabel(selectedRequest.userRole)}
                  </Text>
                </View>

                <View>
                  <Text className="text-foreground font-semibold mb-2">
                    Rejection Reason *
                  </Text>
                  <TextInput
                    value={rejectionReason}
                    onChangeText={setRejectionReason}
                    placeholder="Provide a reason for rejection..."
                    placeholderTextColor="#9CA3AF"
                    multiline
                    numberOfLines={4}
                    className="bg-surface border border-border rounded-lg p-3 text-foreground"
                    style={{ textAlignVertical: 'top' }}
                  />
                </View>

                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={() => setShowRejectionModal(false)}
                    className="flex-1 bg-surface border border-border rounded-lg py-3 items-center"
                  >
                    <Text className="text-foreground font-semibold">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleReject}
                    className="flex-1 bg-error rounded-lg py-3 items-center"
                  >
                    <Text className="text-white font-semibold">Reject</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
