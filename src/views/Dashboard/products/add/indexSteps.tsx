'use client'

import { useState, useEffect } from 'react'

import { styled } from '@mui/material/styles'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Stepper from '@mui/material/Stepper'
import MuiStep from '@mui/material/Step'
import StepLabel from '@mui/material/StepLabel'
import Typography from '@mui/material/Typography'
import type { StepProps } from '@mui/material/Step'
import classnames from 'classnames'

import CustomAvatar from '@core/components/mui/Avatar'
import StepProductDetails from './StepProductDetails'
import StepVariantDetails from './StepVariantDetails'
import StepperWrapper from '@core/styles/stepper'
import { useProduct } from '@/hooks/useProducts'

const steps = [
  {
    icon: 'tabler-package',
    title: 'Información del Producto',
    subtitle: 'Datos básicos del producto'
  },
  {
    icon: 'tabler-palette',
    title: 'Variantes',
    subtitle: 'Colores, tallas y stock'
  }
]

const Step = styled(MuiStep)<StepProps>({
  '&.Mui-completed .step-title , &.Mui-completed .step-subtitle': {
    color: 'var(--mui-palette-text-disabled)'
  }
})

type WizardMode = 'create' | 'edit'

interface ProductWizardProps {
  mode?: WizardMode
  productId?: string
}

const getStepContent = (
  step: number,
  handleNext: () => void,
  handlePrev: () => void,
  mode: WizardMode,
  productId?: string,
  productName?: string,
  productCreated?: boolean,
  onProductCreated?: (id: string, name: string) => void
) => {
  if (step === 0) {
    return (
      <StepProductDetails
        activeStep={step}
        handleNext={handleNext}
        handlePrev={handlePrev}
        steps={steps}
        mode={mode}
        productId={productId}
        onProductCreated={onProductCreated}
      />
    )
  } else {
    return (
      <StepVariantDetails
        activeStep={step}
        handleNext={handleNext}
        handlePrev={handlePrev}
        steps={steps}
        mode={mode}
        productId={productId}
        productName={productName}
        productCreated={productCreated}
      />
    )
  }
}

const ProductWizard = ({ mode = 'create', productId }: ProductWizardProps) => {
  const [activeStep, setActiveStep] = useState<number>(0)
  const [productCreated, setProductCreated] = useState<boolean>(mode === 'edit' || !!productId)
  const [createdProductId, setCreatedProductId] = useState<string | undefined>(productId)
  const [createdProductName, setCreatedProductName] = useState<string | undefined>()

  const { data: productData } = useProduct(mode === 'edit' && productId ? parseInt(productId) : 0)

  useEffect(() => {
    if (mode === 'edit' && productData?.name) {
      setCreatedProductName(productData.name)
    }
  }, [productData, mode])

  const isCreateMode = mode === 'create'
  const isEditMode = mode === 'edit'

  const handleNext = () => {
    if (activeStep !== steps.length - 1) {
      setActiveStep(activeStep + 1)
    }
  }

  const handlePrev = () => {
    if (activeStep !== 0) {
      setActiveStep(activeStep - 1)
    }
  }

  const handleStepClick = (stepIndex: number) => {
    if (isCreateMode) {
      if (stepIndex === 0) {
        setActiveStep(0)
      } else if (stepIndex === 1 && productCreated) {
        setActiveStep(1)
      }
    } else if (isEditMode) {
      setActiveStep(stepIndex)
    }
  }

  const onProductCreated = (id: string, name: string) => {
    setProductCreated(true)
    setCreatedProductId(id)
    setCreatedProductName(name)

    if (isCreateMode) {
      setActiveStep(1)
    }
  }

  const isStepDisabled = (stepIndex: number): boolean => {
    if (isEditMode) return false
    if (stepIndex === 0) return false
    if (stepIndex === 1) return !productCreated

    return false
  }

  const getStepStatus = (stepIndex: number): 'active' | 'completed' | 'disabled' | 'pending' => {
    if (stepIndex === activeStep) return 'active'
    if (stepIndex < activeStep) return 'completed'
    if (isStepDisabled(stepIndex)) return 'disabled'

    // Disponible pero no es el paso actual (ej. en modo editar, viendo el paso 0)
    return 'pending'
  }

  return (
    <Card className='flex flex-col lg:flex-row'>
      <CardContent className='max-lg:border-be lg:border-ie lg:is-[200px] lg:shrink-0'>
        <StepperWrapper>
          <Stepper activeStep={activeStep} orientation='vertical' connector={<></>} className='flex flex-col gap-3'>
            {steps.map((label, index) => {
              const stepStatus = getStepStatus(index)
              const isDisabled = isStepDisabled(index)

              return (
                <Step key={index} onClick={() => !isDisabled && handleStepClick(index)}>
                  <StepLabel
                    icon={<></>}
                    className={classnames('p-1 rounded', {
                      'cursor-pointer': !isDisabled,
                      'cursor-not-allowed opacity-50': isDisabled
                    })}
                    sx={
                      stepStatus === 'active'
                        ? {
                            bgcolor: 'var(--mui-palette-primary-lightOpacity)',
                            borderInlineStart: '3px solid var(--mui-palette-primary-main)'
                          }
                        : { borderInlineStart: '3px solid transparent' }
                    }
                  >
                    <div className='flex flex-col items-center text-center gap-1 is-full'>
                      <CustomAvatar
                        variant='rounded'
                        skin={stepStatus === 'active' ? 'filled' : stepStatus === 'completed' ? 'filled' : 'light'}
                        color={
                          stepStatus === 'disabled' ? 'secondary' : stepStatus === 'completed' ? 'success' : 'primary'
                        }
                        {...(stepStatus === 'active' && { className: 'shadow-primarySm' })}
                        size={32}
                      >
                        {stepStatus === 'completed' ? (
                          <i className='tabler-check !text-[18px]' />
                        ) : (
                          <i className={classnames(label.icon as string, '!text-[18px]')} />
                        )}
                      </CustomAvatar>
                      <div className='flex flex-col items-center'>
                        <Typography
                          color='text.primary'
                          className={classnames('step-title', {
                            'opacity-50': isDisabled
                          })}
                        >
                          {label.title}
                        </Typography>
                        <Typography
                          className={classnames('step-subtitle', {
                            'opacity-50': isDisabled
                          })}
                        >
                          {label.subtitle}
                        </Typography>
                      </div>
                    </div>
                  </StepLabel>
                </Step>
              )
            })}
          </Stepper>
        </StepperWrapper>
      </CardContent>

      <CardContent className='flex-1 pbs-6'>
        {getStepContent(
          activeStep,
          handleNext,
          handlePrev,
          mode,
          createdProductId,
          createdProductName,
          productCreated,
          onProductCreated
        )}
      </CardContent>
    </Card>
  )
}

export default ProductWizard
