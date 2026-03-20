"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
    },
  },
};

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-1">
      {[...Array(rating)].map((_, i) => (
        <svg
          key={i}
          className="w-5 h-5 text-yellow-400"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function TestimonialCard({
  name,
  role,
  avatar,
  content,
}: {
  name: string;
  role: string;
  avatar: string;
  content: string;
}) {
  return (
    <motion.div
      variants={itemVariants}
      whileHover={{ y: -8 }}
      className="bg-v2-bg-surface rounded-lg p-6 shadow-lg hover:shadow-xl transition-shadow"
    >
      <div className="flex items-center gap-4 mb-4">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-v2-gold-primary to-v2-text-secondary flex items-center justify-center text-v2-bg-dark font-semibold">
          {avatar}
        </div>
        <div>
          <h4 className="font-semibold text-white">{name}</h4>
          <p className="text-sm text-v2-text-tertiary">{role}</p>
        </div>
      </div>
      <StarRating rating={5} />
      <p className="mt-4 text-v2-text-tertiary leading-relaxed">
        {content}
      </p>
    </motion.div>
  );
}

export function LandingTestimonials() {
  const t = useTranslations("landing.testimonials");

  const testimonialKeys = ["user1", "user2", "user3"] as const;
  const avatars = ["NA", "TB", "LC"];

  return (
    <section className="py-16 sm:py-20 bg-v2-bg-primary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            {t("sectionTitle")}
          </h2>
          <p className="text-lg text-v2-text-tertiary max-w-2xl mx-auto">
            {t("sectionSubtitle")}
          </p>
        </motion.div>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8"
        >
          {testimonialKeys.map((key, index) => (
            <TestimonialCard
              key={index}
              name={t(`items.${key}.name`)}
              role={t(`items.${key}.role`)}
              avatar={avatars[index]}
              content={t(`items.${key}.content`)}
            />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
