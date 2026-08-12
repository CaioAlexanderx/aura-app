import { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, Pressable, TextInput,
  ScrollView, Switch, Linking, Platform, ActivityIndicator,
} from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useMembers } from "@/hooks/useMembers";
import { useMemberAudit, AUDIT_LABELS, type AuditAction, type AuditEntry } from "@/hooks/useMemberAudit";
import { useMemberTemplates, type RoleTemplate } from "@/hooks/useMemberTemplates";
import { useAuthStore } from "@/stores/auth";
import type { Member, SiblingCompany } from "@/hooks/useMembers";
