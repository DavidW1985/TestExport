import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Edit, Trash2, DollarSign, Users, Clock, CheckCircle2, X } from "lucide-react";
import type { PricingPackage } from "@shared/schema";

interface PackagesResponse {
  success: boolean;
  packages: PricingPackage[];
}

export default function PricingPackagesPage() {
  const [editingPackage, setEditingPackage] = useState<PricingPackage | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: packagesData, isLoading } = useQuery<PackagesResponse>({
    queryKey: ['/api/pricing-packages'],
  });

  const updatePackageMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<PricingPackage> }) => {
      return apiRequest(`/api/pricing-packages/${data.id}`, {
        method: 'PUT',
        body: JSON.stringify(data.updates),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pricing-packages'] });
      setIsDialogOpen(false);
      setEditingPackage(null);
      toast({
        title: "Success",
        description: "Pricing package updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update pricing package: ${error}`,
        variant: "destructive",
      });
    },
  });

  const packages = packagesData?.packages || [];

  const handleEditPackage = (pkg: PricingPackage) => {
    setEditingPackage(pkg);
    setIsDialogOpen(true);
  };

  const handleSavePackage = (formData: FormData) => {
    if (!editingPackage) return;

    const updates = {
      displayName: formData.get('displayName') as string,
      description: formData.get('description') as string,
      price: parseFloat(formData.get('price') as string),
      targetIncomeLevel: formData.get('targetIncomeLevel') as string,
      complexityLevel: formData.get('complexityLevel') as string,
      familySize: formData.get('familySize') as string,
      urgencyLevel: formData.get('urgencyLevel') as string,
      destinationTypes: JSON.stringify(formData.get('destinationTypes')?.toString().split(',') || []),
      includesVisaSupport: formData.get('includesVisaSupport') === 'on',
      includesHousingSearch: formData.get('includesHousingSearch') === 'on',
      includesTaxAdvice: formData.get('includesTaxAdvice') === 'on',
      includesEducationPlanning: formData.get('includesEducationPlanning') === 'on',
      includesHealthcareGuidance: formData.get('includesHealthcareGuidance') === 'on',
      includesWorkPermitHelp: formData.get('includesWorkPermitHelp') === 'on',
      consultationHours: parseInt(formData.get('consultationHours') as string),
      followUpSessions: parseInt(formData.get('followUpSessions') as string),
      documentReviews: parseInt(formData.get('documentReviews') as string),
    };

    updatePackageMutation.mutate({ id: editingPackage.id, updates });
  };

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'simple': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'moderate': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'complex': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pricing Packages</h1>
          <p className="text-muted-foreground mt-1">
            Manage pricing packages and their matching characteristics
          </p>
        </div>
      </div>

      {/* Package Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total Packages</p>
                <p className="text-2xl font-bold" data-testid="stat-total-packages">
                  {packages.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Active Packages</p>
                <p className="text-2xl font-bold" data-testid="stat-active-packages">
                  {packages.filter(p => p.isActive).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-purple-600" />
              <div>
                <p className="text-sm text-muted-foreground">Avg Price</p>
                <p className="text-2xl font-bold" data-testid="stat-avg-price">
                  ${packages.length > 0 ? Math.round(packages.reduce((sum, p) => sum + p.price, 0) / packages.length) : 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Packages Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {packages.map((pkg) => (
          <Card key={pkg.id} className="relative">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{pkg.displayName}</CardTitle>
                  <CardDescription className="mt-1">
                    {pkg.description.substring(0, 80)}...
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEditPackage(pkg)}
                  data-testid={`button-edit-${pkg.id}`}
                >
                  <Edit className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Price */}
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">${pkg.price}</span>
                  <span className="text-sm text-muted-foreground">{pkg.currency}</span>
                </div>

                {/* Characteristics */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Badge className={getComplexityColor(pkg.complexityLevel)}>
                      {pkg.complexityLevel}
                    </Badge>
                    <Badge variant="outline">{pkg.familySize || 'any'}</Badge>
                    <Badge variant="outline">{pkg.targetIncomeLevel || 'any'}</Badge>
                  </div>
                </div>

                {/* Service Inclusions */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {pkg.includesVisaSupport && (
                    <div className="flex items-center space-x-1">
                      <CheckCircle2 className="w-3 h-3 text-green-600" />
                      <span>Visa Support</span>
                    </div>
                  )}
                  {pkg.includesHousingSearch && (
                    <div className="flex items-center space-x-1">
                      <CheckCircle2 className="w-3 h-3 text-green-600" />
                      <span>Housing Search</span>
                    </div>
                  )}
                  {pkg.includesTaxAdvice && (
                    <div className="flex items-center space-x-1">
                      <CheckCircle2 className="w-3 h-3 text-green-600" />
                      <span>Tax Advice</span>
                    </div>
                  )}
                  {pkg.includesEducationPlanning && (
                    <div className="flex items-center space-x-1">
                      <CheckCircle2 className="w-3 h-3 text-green-600" />
                      <span>Education Planning</span>
                    </div>
                  )}
                  {pkg.includesHealthcareGuidance && (
                    <div className="flex items-center space-x-1">
                      <CheckCircle2 className="w-3 h-3 text-green-600" />
                      <span>Healthcare</span>
                    </div>
                  )}
                  {pkg.includesWorkPermitHelp && (
                    <div className="flex items-center space-x-1">
                      <CheckCircle2 className="w-3 h-3 text-green-600" />
                      <span>Work Permits</span>
                    </div>
                  )}
                </div>

                {/* Package Limits */}
                <div className="border-t pt-3 text-sm text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Consultation Hours:</span>
                    <span>{pkg.consultationHours}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Follow-up Sessions:</span>
                    <span>{pkg.followUpSessions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Document Reviews:</span>
                    <span>{pkg.documentReviews}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Package Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Pricing Package</DialogTitle>
            <DialogDescription>
              Update the package characteristics and service inclusions.
            </DialogDescription>
          </DialogHeader>

          {editingPackage && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSavePackage(new FormData(e.target as HTMLFormElement));
              }}
              className="space-y-4"
            >
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="basic">Basic Info</TabsTrigger>
                  <TabsTrigger value="characteristics">Characteristics</TabsTrigger>
                  <TabsTrigger value="services">Services</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="displayName">Display Name</Label>
                      <Input
                        id="displayName"
                        name="displayName"
                        defaultValue={editingPackage.displayName}
                        data-testid="input-display-name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="price">Price (USD)</Label>
                      <Input
                        id="price"
                        name="price"
                        type="number"
                        step="0.01"
                        defaultValue={editingPackage.price}
                        data-testid="input-price"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      name="description"
                      defaultValue={editingPackage.description}
                      rows={3}
                      data-testid="textarea-description"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="characteristics" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="targetIncomeLevel">Income Level</Label>
                      <Select name="targetIncomeLevel" defaultValue={editingPackage.targetIncomeLevel || ""}>
                        <SelectTrigger data-testid="select-income-level">
                          <SelectValue placeholder="Select income level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Any</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="complexityLevel">Complexity</Label>
                      <Select name="complexityLevel" defaultValue={editingPackage.complexityLevel}>
                        <SelectTrigger data-testid="select-complexity">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="simple">Simple</SelectItem>
                          <SelectItem value="moderate">Moderate</SelectItem>
                          <SelectItem value="complex">Complex</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="familySize">Family Size</Label>
                      <Select name="familySize" defaultValue={editingPackage.familySize || ""}>
                        <SelectTrigger data-testid="select-family-size">
                          <SelectValue placeholder="Select family size" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Any</SelectItem>
                          <SelectItem value="individual">Individual</SelectItem>
                          <SelectItem value="couple">Couple</SelectItem>
                          <SelectItem value="family">Family</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="urgencyLevel">Urgency</Label>
                      <Select name="urgencyLevel" defaultValue={editingPackage.urgencyLevel || ""}>
                        <SelectTrigger data-testid="select-urgency">
                          <SelectValue placeholder="Select urgency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Any</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="services" className="space-y-4">
                  <div className="space-y-4">
                    <h4 className="font-medium">Service Inclusions</h4>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        ['includesVisaSupport', 'Visa Support'],
                        ['includesHousingSearch', 'Housing Search'],
                        ['includesTaxAdvice', 'Tax Advice'],
                        ['includesEducationPlanning', 'Education Planning'],
                        ['includesHealthcareGuidance', 'Healthcare Guidance'],
                        ['includesWorkPermitHelp', 'Work Permit Help']
                      ].map(([key, label]) => (
                        <div key={key} className="flex items-center space-x-2">
                          <Switch
                            name={key}
                            defaultChecked={editingPackage[key as keyof PricingPackage] as boolean}
                            data-testid={`switch-${key}`}
                          />
                          <Label>{label}</Label>
                        </div>
                      ))}
                    </div>

                    <h4 className="font-medium mt-6">Package Limits</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="consultationHours">Consultation Hours</Label>
                        <Input
                          name="consultationHours"
                          type="number"
                          defaultValue={editingPackage.consultationHours}
                          data-testid="input-consultation-hours"
                        />
                      </div>
                      <div>
                        <Label htmlFor="followUpSessions">Follow-up Sessions</Label>
                        <Input
                          name="followUpSessions"
                          type="number"
                          defaultValue={editingPackage.followUpSessions}
                          data-testid="input-followup-sessions"
                        />
                      </div>
                      <div>
                        <Label htmlFor="documentReviews">Document Reviews</Label>
                        <Input
                          name="documentReviews"
                          type="number"
                          defaultValue={editingPackage.documentReviews}
                          data-testid="input-document-reviews"
                        />
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updatePackageMutation.isPending}
                  data-testid="button-save"
                >
                  {updatePackageMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}